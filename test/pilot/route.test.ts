import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import { resolveMode } from '../../src/modes.js';
import { routeNext, type Route } from '../../src/pilot/route.js';
import { createState, type Report, type StageName, type UnitState } from '../../src/store/state.js';

const thorough = resolveMode('thorough', DEFAULTS);
const express = resolveMode('express', DEFAULTS);
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
  ['no report yet dispatches the current stage', st('scope'), thorough, false, { next: 'scope', decision: 'proceed' }],
  ['done at scope proceeds to plan', withReports('scope', [rep('scope', 'done')]), thorough, false, { next: 'plan', decision: 'proceed' }],
  ['done at commit proceeds to review', withReports('commit', [rep('commit', 'done')]), thorough, false, { next: 'review', decision: 'proceed' }],
  ['blocked report blocks with its questions', withReports('plan', [rep('plan', 'blocked', { questions: ['Which API version?'] })]), thorough, false, { next: 'plan', decision: 'blocked', questions: ['Which API version?'] }],
  ['review needs_attention retries via revise', withReports('review', [rep('review', 'done', { verdict: 'needs_attention' })]), thorough, false, { next: 'revise', decision: 'retry', verdict: 'needs_attention' }],
  ['review not_ready retries via revise', withReports('review', [rep('review', 'done', { verdict: 'not_ready' })]), thorough, false, { next: 'revise', decision: 'retry', verdict: 'not_ready' }],
  ['review not_ready at cycle 4 blocks', withReports('review', [rep('review', 'done', { verdict: 'not_ready' }, 4)], { cycle: 4 }), thorough, false, { decision: 'blocked' }],
  ['review ship without challenge goes to challenge', withReports('review', [rep('review', 'done', { verdict: 'ship' })]), thorough, false, { next: 'challenge', decision: 'proceed', verdict: 'ship' }],
  ['review ship with challenge passed skips to publish without browser_ui', withReports('review', [rep('review', 'done', { verdict: 'ship' })], { challenge_passed: true }), thorough, false, { next: 'publish', decision: 'proceed' }],
  ['review ship with challenge passed goes to verify with browser_ui', withReports('review', [rep('review', 'done', { verdict: 'ship' })], { challenge_passed: true }), thorough, true, { next: 'verify', decision: 'proceed' }],
  ['review without a verdict blocks', withReports('review', [rep('review', 'done')]), thorough, false, { decision: 'blocked' }],
  ['challenge ship goes to publish without browser_ui', withReports('challenge', [rep('challenge', 'done', { verdict: 'ship' })]), thorough, false, { next: 'publish', decision: 'proceed' }],
  ['challenge ship goes to verify with browser_ui', withReports('challenge', [rep('challenge', 'done', { verdict: 'ship' })]), thorough, true, { next: 'verify', decision: 'proceed' }],
  ['challenge findings retry via revise', withReports('challenge', [rep('challenge', 'done', { verdict: 'needs_attention' })]), thorough, false, { next: 'revise', decision: 'retry' }],
  ['verify done proceeds to publish', withReports('verify', [rep('verify', 'done')]), thorough, true, { next: 'publish', decision: 'proceed' }],
  ['express: challenge ship goes to publish first even with browser_ui', withReports('challenge', [rep('challenge', 'done', { verdict: 'ship' })], { mode: 'express' }), express, true, { next: 'publish', decision: 'proceed' }],
  ['express: publish done goes to verify after publish with browser_ui', withReports('publish', [rep('publish', 'done')], { mode: 'express' }), express, true, { next: 'verify', decision: 'proceed' }],
  ['express: publish done goes to close without browser_ui', withReports('publish', [rep('publish', 'done')], { mode: 'express' }), express, false, { next: 'close', decision: 'proceed' }],
  ['express: verify done after publish goes to close', withReports('verify', [rep('verify', 'done')], { mode: 'express' }), express, true, { next: 'close', decision: 'proceed' }],
  ['sketch: commit done skips straight to publish', withReports('commit', [rep('commit', 'done')], { mode: 'sketch' }), sketch, true, { next: 'publish', decision: 'proceed' }],
  ['publish done proceeds to close', withReports('publish', [rep('publish', 'done')]), thorough, false, { next: 'close', decision: 'proceed' }],
  ['close done is done', withReports('close', [rep('close', 'done')]), thorough, false, { next: null, decision: 'done' }],
  ['commit failed once retries', withReports('commit', [rep('commit', 'failed')]), thorough, false, { next: 'commit', decision: 'retry' }],
  ['commit failed twice retries', withReports('commit', [rep('commit', 'failed'), rep('commit', 'failed')]), thorough, false, { next: 'commit', decision: 'retry' }],
  ['commit failed three times blocks', withReports('commit', [rep('commit', 'failed'), rep('commit', 'failed'), rep('commit', 'failed')]), thorough, false, { next: 'commit', decision: 'blocked' }],
  ['build failed once retries', withReports('build', [rep('build', 'failed')]), thorough, false, { next: 'build', decision: 'retry' }],
  ['build failed twice blocks', withReports('build', [rep('build', 'failed'), rep('build', 'failed')]), thorough, false, { next: 'build', decision: 'blocked' }],
  ['revise done returns to commit', withReports('revise', [rep('revise', 'done')]), thorough, false, { next: 'commit', decision: 'proceed' }],
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
