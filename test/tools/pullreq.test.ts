import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../src/registry/tools.js';
import { readState, writeState, type TimerRecord } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { suggestWorklog } from '../../src/time/worklog.js';
import { evidenceTool } from '../../src/tools/evidence.js';
import { pullreqTool } from '../../src/tools/pullreq.js';
import { specTool } from '../../src/tools/spec.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

async function unitCtx(mode = 'thorough', id = 'PR-1') {
  const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id, mode }, ctx);
  await dispatch(specTool, { action: 'record', id, title: 'Export button', body: 'Add an export button.' }, ctx);
  await dispatch(specTool, { action: 'criteria', id, set: ['Button visible', 'CSV downloads'] }, ctx);
  return ctx;
}

describe('pullreq body', () => {
  it('renders the ghostwritten body with every criterion and the mode section', async () => {
    const ctx = await unitCtx('express');
    await dispatch(evidenceTool, { action: 'record', id: 'PR-1', kind: 'criteria_validation', payload: { results: [{ criterion: 'AC-1', status: 'proven', proof: 'snapshot test' }] } }, ctx);
    fs.writeFileSync(path.join(unitDirFor(ctx, 'PR-1'), 'plan.md'), '# Plan\n\n## Deferred\n\n- Excel export\n');
    const r = await dispatch(pullreqTool, { action: 'body', id: 'PR-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('AC-1');
    expect(r.text).toContain('AC-2');
    expect(r.text).toContain('Excel export');
    expect(r.text).toContain('reach_audit_recorded → warn');
    const draft = path.join(unitDirFor(ctx, 'PR-1'), 'drafts', 'pr-body.md');
    expect(fs.existsSync(draft)).toBe(true);
    expect((r.envelope.data as { draft: string }).draft).toMatch(/pr-body\.md$/);
  });

  it('starts a sketch body with the banner', async () => {
    const ctx = await unitCtx('sketch');
    const r = await dispatch(pullreqTool, { action: 'body', id: 'PR-1' }, ctx);
    const body = (r.envelope.data as { body: string }).body;
    expect(body.split('\n')[0]).toMatch(/nothing reviewed/i);
  });
});

describe('pullreq record, threads, get', () => {
  it('records the PR, stops the stage timer, and satisfies pr_recorded', async () => {
    const ctx = await unitCtx();
    const before = await dispatch(evidenceTool, { action: 'check', id: 'PR-1', gate: 'pr_recorded' }, ctx);
    expect(before.envelope.data).toMatchObject({ status: 'fail' });
    const r = await dispatch(pullreqTool, { action: 'record', id: 'PR-1', url: 'https://example.test/o/n/pull/7', number: 7, base: 'main', head: 'PR-1-export-button' }, ctx);
    expect(r.envelope.ok).toBe(true);
    const state = readState(unitDirFor(ctx, 'PR-1'));
    expect(state.pr).toMatchObject({ url: 'https://example.test/o/n/pull/7', number: 7, base: 'main', head: 'PR-1-export-button', threads: [] });
    expect(state.pr!.opened_at).toBe('2026-09-04T12:00:00.000Z');
    expect(state.timers.every((t) => t.ended_at !== null)).toBe(true);
    expect(fs.readFileSync(path.join(unitDirFor(ctx, 'PR-1'), 'history.md'), 'utf8')).toContain('pull/7');
    const after = await dispatch(evidenceTool, { action: 'check', id: 'PR-1', gate: 'pr_recorded' }, ctx);
    expect(after.envelope.data).toMatchObject({ status: 'pass' });
  });

  it('replaces threads and returns everything via get', async () => {
    const ctx = await unitCtx();
    const noPr = await dispatch(pullreqTool, { action: 'threads', id: 'PR-1', threads: [] }, ctx);
    expect(noPr.envelope.ok).toBe(false);
    await dispatch(pullreqTool, { action: 'record', id: 'PR-1', url: 'https://example.test/o/n/pull/7', base: 'main', head: 'PR-1' }, ctx);
    const threads = [
      { id: 't1', author: 'reviewer', body: 'nit: rename', path: 'src/a.ts', line: 3, resolved: false },
      { id: 't2', author: 'bot', body: 'LGTM', resolved: true },
    ];
    const t = await dispatch(pullreqTool, { action: 'threads', id: 'PR-1', threads }, ctx);
    expect(t.envelope.ok).toBe(true);
    expect(t.envelope.data).toMatchObject({ total: 2, open: 1 });
    const got = await dispatch(pullreqTool, { action: 'get', id: 'PR-1' }, ctx);
    expect(got.envelope.data).toMatchObject({ pr: { url: 'https://example.test/o/n/pull/7', number: null, threads } });
    const replaced = await dispatch(pullreqTool, { action: 'threads', id: 'PR-1', threads: [threads[1]] }, ctx);
    expect((replaced.envelope.data as { total: number }).total).toBe(1);
    const gone = await dispatch(pullreqTool, { action: 'get', id: 'PR-2' }, ctx);
    expect(gone.envelope.ok).toBe(false);
  });
});

describe('worklog', () => {
  const t = (stage: TimerRecord['stage'], start: string, end: string | null, idle = 0): TimerRecord => ({ stage, started_at: start, ended_at: end, idle_gaps_ms: idle });

  it('sums minutes per stage, subtracting recorded idle gaps', () => {
    const timers = [
      t('scope', '2026-09-04T09:00:00.000Z', '2026-09-04T09:30:00.000Z'),
      t('plan', '2026-09-04T09:30:00.000Z', '2026-09-04T10:30:00.000Z', 20 * 60_000),
      t('build', '2026-09-04T10:30:00.000Z', '2026-09-04T12:00:00.000Z', 10 * 60_000),
      t('scope', '2026-09-04T12:00:00.000Z', '2026-09-04T12:10:00.000Z'),
    ];
    const w = suggestWorklog(timers);
    expect(w.stages).toEqual([{ stage: 'scope', minutes: 40 }, { stage: 'plan', minutes: 40 }, { stage: 'build', minutes: 80 }]);
    expect(w.total_minutes).toBe(160);
    expect(w.idle_minutes).toBe(30);
  });

  it('only subtracts gaps between timers that exceed the threshold and counts open timers up to now', () => {
    const timers = [
      t('scope', '2026-09-04T09:00:00.000Z', '2026-09-04T09:30:00.000Z'),
      t('plan', '2026-09-04T10:00:00.000Z', '2026-09-04T10:30:00.000Z'),
      t('build', '2026-09-04T10:40:00.000Z', null),
    ];
    const now = new Date('2026-09-04T11:00:00.000Z');
    const w = suggestWorklog(timers, 15 * 60_000, now);
    expect(w.stages).toEqual([{ stage: 'scope', minutes: 30 }, { stage: 'plan', minutes: 30 }, { stage: 'build', minutes: 20 }]);
    expect(w.idle_minutes).toBe(30);
    expect(w.gaps).toEqual([{ after: 'scope', before: 'plan', minutes: 30 }]);
  });

  it('is exposed through pullreq worklog', async () => {
    const ctx = await unitCtx();
    const dir = unitDirFor(ctx, 'PR-1');
    writeState(dir, { ...readState(dir), timers: [t('scope', '2026-09-04T09:00:00.000Z', '2026-09-04T10:00:00.000Z', 20 * 60_000)] });
    const r = await dispatch(pullreqTool, { action: 'worklog', id: 'PR-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toMatchObject({ total_minutes: 40, stages: [{ stage: 'scope', minutes: 40 }] });
    expect(r.text).toContain('40');
  });
});
