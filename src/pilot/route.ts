import type { ModeDef } from '../modes.js';
import { nextStageFor, type FlowName } from '../registry/stages.js';
import type { Report, ReviewVerdict, StageName, UnitState } from '../store/state.js';

export type Decision = 'proceed' | 'retry' | 'blocked' | 'done';

export interface Route {
  /** A core stage, the standalone `respond` flow for a bot round, or null when done. */
  next: StageName | FlowName | null;
  decision: Decision;
  verdict?: ReviewVerdict;
  questions: string[];
}

export const MAX_REVIEW_CYCLES = 4;
export const MAX_COMMIT_FAILURES = 2;
export const MAX_OTHER_FAILURES = 1;
export const MAX_BOT_ROUNDS = 2;

function reportsFor(state: UnitState, stage: StageName): Report[] {
  return (state.reports?.[stage] ?? []).filter((r) => r.cycle === state.cycle);
}

function afterChallenge(state: UnitState, mode: ModeDef, browserUi: boolean): StageName {
  return nextStageFor('challenge', { skip: mode.skip_stages, browserUi, verifyAfterPublish: mode.verify_after_publish }) ?? 'publish';
}

/**
 * Decide what the conductor does next from the unit's reports for the
 * current stage and cycle. Pure: never mutates the state. With a wired
 * reviewbot seat, a publish report routes to the respond flow while the bot
 * requests changes and the round cap is not exceeded.
 */
export function routeNext(state: UnitState, mode: ModeDef, browserUi = false, reviewbotWired = false): Route {
  const stage = state.stage;
  const reports = reportsFor(state, stage);
  const latest = reports.at(-1);
  const opts = { skip: mode.skip_stages, browserUi, verifyAfterPublish: mode.verify_after_publish };

  if (!latest) return { next: stage, decision: 'proceed', questions: [] };

  if (latest.outcome === 'blocked') {
    return { next: stage, decision: 'blocked', questions: latest.questions.length ? latest.questions : [`${stage} reported blocked: ${latest.summary}`] };
  }

  if (latest.outcome === 'failed') {
    const failures = reports.filter((r) => r.outcome === 'failed').length;
    const cap = stage === 'commit' ? MAX_COMMIT_FAILURES : MAX_OTHER_FAILURES;
    if (failures <= cap) return { next: stage, decision: 'retry', questions: [] };
    return { next: stage, decision: 'blocked', questions: [`${stage} failed ${failures} times; last: ${latest.summary}`] };
  }

  if (stage === 'close') return { next: null, decision: 'done', questions: [] };

  if (stage === 'review' || stage === 'challenge') {
    const verdict = latest.verdict ?? state.reviews?.[state.cycle];
    if (!verdict) return { next: stage, decision: 'blocked', questions: [`${stage} finished without a verdict; synthesize the review columns and report again`] };
    if (verdict !== 'ship') {
      if (state.cycle < MAX_REVIEW_CYCLES) return { next: 'revise', decision: 'retry', verdict, questions: [] };
      return { next: stage, decision: 'blocked', verdict, questions: [`${stage} verdict is ${verdict} after ${state.cycle} cycles; a human should decide how to proceed`] };
    }
    if (stage === 'review' && !state.challenge_passed && !mode.skip_stages.includes('challenge')) {
      return { next: 'challenge', decision: 'proceed', verdict, questions: [] };
    }
    return { next: afterChallenge(state, mode, browserUi), decision: 'proceed', verdict, questions: [] };
  }

  if (stage === 'publish' && reviewbotWired && state.bot?.status === 'changes_requested' && state.bot.round <= MAX_BOT_ROUNDS) {
    return { next: 'respond', decision: 'proceed', questions: [] };
  }

  const next = nextStageFor(stage, opts);
  if (!next) return { next: null, decision: 'done', questions: [] };
  return { next, decision: 'proceed', questions: [] };
}
