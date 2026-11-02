import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import { resolveMode } from '../../src/modes.js';
import { routeNext, type Route } from '../../src/conductor/route.js';
import { createState, type Report, type StageName, type UnitState } from '../../src/store/state.js';

const thorough = resolveMode('thorough', DEFAULTS);
const sketch = resolveMode('sketch', DEFAULTS);

function st(stage: StageName, over: Partial<UnitState> = {}): UnitState {
  return { ...createState({ id: 'RT-1', repo: 'local/x', tracked: true, source: { kind: 'ticket', ref: 'RT-1', pinned: true }, mode: 'thorough', base_branch: 'main' }), stage, ...over };
}

function rep(stage: StageName, outcome: Report['outcome'], over: Partial<Report> = {}, cycle = 0): Report {
  return { stage, cycle, outcome, summary: `${stage} ${outcome}`, questions: [], artifacts: {}, at: '2026-09-04T00:00:00.000Z', ...over };
}

function withReports(stage: StageName, reports: Report[], over: Partial<UnitState> = {}): UnitState {
  const grouped: Record<string, Report[]> = {};
  for (const r of reports) (grouped[r.stage] ??= []).push(r);
  return st(stage, { reports: grouped, ...over });
}

type Case = [name: string, state: UnitState, mode: typeof thorough, browserUi: boolean, expected: Partial<Route>];

const cases: Case[] = [
  ['no report dispatches the current stage', st('define'), thorough, false, { next: 'define', decision: 'proceed' }],
  ['define done proceeds to build', withReports('define', [rep('define', 'done')]), thorough, false, { next: 'build', decision: 'proceed' }],
  ['build done proceeds to review', withReports('build', [rep('build', 'done')]), thorough, false, { next: 'review', decision: 'proceed' }],
  ['blocked report blocks with questions', withReports('build', [rep('build', 'blocked', { questions: ['Which API?'] })]), thorough, false, { next: 'build', decision: 'blocked', questions: ['Which API?'] }],
  ['review needs_attention retries via build', withReports('review', [rep('review', 'done', { verdict: 'needs_attention' })]), thorough, false, { next: 'build', decision: 'retry', verdict: 'needs_attention' }],
  ['review not_ready retries via build', withReports('review', [rep('review', 'done', { verdict: 'not_ready' })]), thorough, false, { next: 'build', decision: 'retry', verdict: 'not_ready' }],
  ['review not_ready at cycle 4 blocks', withReports('review', [rep('review', 'done', { verdict: 'not_ready' }, 4)], { cycle: 4 }), thorough, false, { decision: 'blocked' }],
  ['review ship goes to pr without browser_ui', withReports('review', [rep('review', 'done', { verdict: 'ship' })]), thorough, false, { next: 'pr', decision: 'proceed', verdict: 'ship' }],
  ['review ship goes to walkthrough with browser_ui', withReports('review', [rep('review', 'done', { verdict: 'ship' })]), thorough, true, { next: 'walkthrough', decision: 'proceed' }],
  ['review without a verdict blocks', withReports('review', [rep('review', 'done')]), thorough, false, { decision: 'blocked' }],
  ['walkthrough done proceeds to pr', withReports('walkthrough', [rep('walkthrough', 'done')]), thorough, true, { next: 'pr', decision: 'proceed' }],
  ['sketch: build done skips straight to pr', withReports('build', [rep('build', 'done')], { mode: 'sketch' }), sketch, true, { next: 'pr', decision: 'proceed' }],
  ['pr done proceeds to wrap_up', withReports('pr', [rep('pr', 'done')]), thorough, false, { next: 'wrap_up', decision: 'proceed' }],
  ['wrap_up done is done', withReports('wrap_up', [rep('wrap_up', 'done')]), thorough, false, { next: null, decision: 'done' }],
  ['build failed once retries', withReports('build', [rep('build', 'failed')]), thorough, false, { next: 'build', decision: 'retry' }],
  ['build failed twice retries', withReports('build', [rep('build', 'failed'), rep('build', 'failed')]), thorough, false, { next: 'build', decision: 'retry' }],
  ['build failed three times blocks', withReports('build', [rep('build', 'failed'), rep('build', 'failed'), rep('build', 'failed')]), thorough, false, { next: 'build', decision: 'blocked' }],
  ['define failed once retries', withReports('define', [rep('define', 'failed')]), thorough, false, { next: 'define', decision: 'retry' }],
  ['define failed twice blocks', withReports('define', [rep('define', 'failed'), rep('define', 'failed')]), thorough, false, { next: 'define', decision: 'blocked' }],
  ['a report from an earlier cycle does not count', withReports('review', [rep('review', 'done', { verdict: 'ship' }, 0)], { cycle: 1 }), thorough, false, { next: 'review', decision: 'proceed' }],
];

describe('routeNext', () => {
  for (const [name, state, mode, browserUi, expected] of cases) {
    it(name, () => {
      const route = routeNext(state, mode, browserUi);
      expect(route).toMatchObject(expected);
      expect(Array.isArray(route.questions)).toBe(true);
    });
  }

  it('blocked routes carry a question even when the report had none', () => {
    const route = routeNext(withReports('review', [rep('review', 'done', { verdict: 'not_ready' }, 4)], { cycle: 4 }), thorough, false);
    expect(route.decision).toBe('blocked');
    expect(route.questions.length).toBeGreaterThan(0);
  });
});
