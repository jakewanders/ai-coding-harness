import { describe, expect, it } from 'vitest';
import { reconcile } from '../../src/pilot/reconcile.js';
import { createState, type StageName, type UnitState } from '../../src/store/state.js';

function st(stage: StageName, over: Partial<UnitState> = {}): UnitState {
  return { ...createState({ id: 'RC-1', repo: 'local/x', tracked: true, source: { kind: 'ticket', ref: 'RC-1', pinned: true }, mode: 'thorough', base_branch: 'main' }), stage, branch: 'RC-1-thing', ...over };
}
const pr = { url: 'https://example.test/pr/1', number: 1, base: 'main', head: 'RC-1-thing', opened_at: '2026-09-04T00:00:00.000Z', threads: [] };

describe('reconcile', () => {
  it('reports nothing for a consistent pair', () => {
    const state = st('publish', { pr });
    expect(reconcile(state, { branch: 'RC-1-thing', uncommitted: false, pr_state: 'open' })).toEqual([]);
    expect(reconcile(st('build'), {})).toEqual([]);
  });

  it('reports a differing branch', () => {
    const d = reconcile(st('build'), { branch: 'main' });
    expect(d.map((x) => x.kind)).toEqual(['branch_differs']);
    expect(d[0]!.detail).toContain('RC-1-thing');
    expect(d[0]!.detail).toContain('main');
  });

  it('reports uncommitted work only from review onward', () => {
    expect(reconcile(st('build'), { uncommitted: true })).toEqual([]);
    for (const stage of ['review', 'challenge', 'verify', 'publish', 'close'] as StageName[]) {
      const d = reconcile(st(stage, { pr: stage === 'close' ? pr : null }), { uncommitted: true, pr_state: stage === 'close' ? 'merged' : undefined });
      expect(d.map((x) => x.kind), stage).toContain('uncommitted_work');
      expect(d.find((x) => x.kind === 'uncommitted_work')!.detail).toContain(stage);
    }
  });

  it('reports pr state disagreements', () => {
    expect(reconcile(st('publish', { pr }), { pr_state: 'merged' }).map((x) => x.kind)).toEqual(['pr_merged_early']);
    expect(reconcile(st('review', { pr }), { pr_state: 'closed' }).map((x) => x.kind)).toEqual(['pr_closed']);
    expect(reconcile(st('publish', { pr }), { pr_state: 'none' }).map((x) => x.kind)).toEqual(['pr_missing_live']);
    expect(reconcile(st('review'), { pr_state: 'open' }).map((x) => x.kind)).toEqual(['pr_unrecorded']);
    expect(reconcile(st('close', { pr }), { pr_state: 'merged' })).toEqual([]);
  });

  it('reports a tracker status that differs from the expected hint', () => {
    const d = reconcile(st('build'), { tracker_status: 'Done' }, { expectedTrackerStatus: 'In Progress' });
    expect(d.map((x) => x.kind)).toEqual(['tracker_status_differs']);
    expect(reconcile(st('build'), { tracker_status: 'In Progress' }, { expectedTrackerStatus: 'In Progress' })).toEqual([]);
    expect(reconcile(st('build'), { tracker_status: 'Whatever' })).toEqual([]);
  });

  it('never mutates the state', () => {
    const state = st('publish', { pr });
    const snapshot = JSON.stringify(state);
    reconcile(state, { branch: 'other', uncommitted: true, pr_state: 'merged', tracker_status: 'x' }, { expectedTrackerStatus: 'y' });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
