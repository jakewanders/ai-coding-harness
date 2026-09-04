import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../src/registry/tools.js';
import { readState, writeState, type UnitState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

async function unitCtx(mode = 'thorough', id = 'PL-1') {
  const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id, mode }, ctx);
  return ctx;
}

function satisfyCommitGates(dir: string) {
  const s: UnitState = readState(dir);
  const at = '2026-09-04T00:00:00.000Z';
  writeState(dir, {
    ...s,
    evidence: [...s.evidence, { kind: 'self_critique', cycle: s.cycle, recorded_at: at, payload: { findings: [] } }, { kind: 'pii', cycle: s.cycle, recorded_at: at, payload: { findings: [] } }],
    runs: [...s.runs, { id: `r-${s.cycle}`, command: 'true', exit: 0, summary: '', log: '~/l.log', started_at: at, ended_at: at, cycle: s.cycle }],
  });
}

describe('unit report and route', () => {
  it('exposes exactly the lean actions', () => {
    expect(Object.keys(unitTool.actions)).toEqual(['start', 'status', 'list', 'brief', 'advance', 'report', 'route', 'answer', 'link']);
  });

  it('persists reports per stage and cycle, and route reads them', async () => {
    const ctx = await unitCtx();
    const first = await dispatch(unitTool, { action: 'route', id: 'PL-1' }, ctx);
    expect(first.envelope.data).toMatchObject({ next: 'scope', decision: 'proceed' });
    expect(readState(unitDirFor(ctx, 'PL-1')).stage).toBe('scope');
    const r = await dispatch(unitTool, { action: 'report', id: 'PL-1', stage: 'scope', outcome: 'done', summary: 'criteria recorded', artifacts: { requirement: '~/x/requirement.md' } }, ctx);
    expect(r.envelope.ok).toBe(true);
    const state = readState(unitDirFor(ctx, 'PL-1'));
    expect(state.reports!.scope).toHaveLength(1);
    expect(state.reports!.scope![0]).toMatchObject({ stage: 'scope', cycle: 0, outcome: 'done', summary: 'criteria recorded', at: '2026-09-04T12:00:00.000Z' });
    const route = await dispatch(unitTool, { action: 'route', id: 'PL-1' }, ctx);
    expect(route.envelope.ok).toBe(true);
    expect(route.envelope.data).toMatchObject({ next: 'build', decision: 'proceed', from: 'scope' });
    expect(readState(unitDirFor(ctx, 'PL-1')).stage).toBe('build');
    expect(route.envelope.next[0]).toMatchObject({ tool: 'unit', action: 'brief' });
  });

  it('returns blocked with the report questions and does not move', async () => {
    const ctx = await unitCtx();
    await dispatch(unitTool, { action: 'report', id: 'PL-1', stage: 'scope', outcome: 'blocked', summary: 'ambiguous', questions: ['Which locale?'] }, ctx);
    const route = await dispatch(unitTool, { action: 'route', id: 'PL-1' }, ctx);
    expect(route.envelope.ok).toBe(false);
    expect(route.envelope.data).toMatchObject({ decision: 'blocked', questions: ['Which locale?'] });
    expect(readState(unitDirFor(ctx, 'PL-1')).stage).toBe('scope');
    const answered = await dispatch(unitTool, { action: 'answer', id: 'PL-1', answers: { 'Which locale?': 'en-US only' } }, ctx);
    expect(answered.envelope.ok).toBe(true);
    expect(readState(unitDirFor(ctx, 'PL-1')).answers).toEqual({ 'Which locale?': 'en-US only' });
    expect(fs.readFileSync(path.join(unitDirFor(ctx, 'PL-1'), 'history.md'), 'utf8')).toContain('en-US only');
  });

  it('turns failing gates into a blocked route with remedies as questions', async () => {
    const ctx = await unitCtx();
    const dir = unitDirFor(ctx, 'PL-1');
    await dispatch(unitTool, { action: 'advance', id: 'PL-1', to: 'build' }, ctx);
    await dispatch(unitTool, { action: 'report', id: 'PL-1', stage: 'build', outcome: 'done', summary: 'built' }, ctx);
    const blocked = await dispatch(unitTool, { action: 'route', id: 'PL-1' }, ctx);
    expect(blocked.envelope.data).toMatchObject({ decision: 'blocked', next: 'build' });
    expect((blocked.envelope.data as { questions: string[] }).questions.join(' ')).toContain('self_critique');
    satisfyCommitGates(dir);
    const ok = await dispatch(unitTool, { action: 'route', id: 'PL-1' }, ctx);
    expect(ok.envelope.data).toMatchObject({ decision: 'proceed', next: 'review' });
    expect(readState(dir).stage).toBe('review');
  });

  it('retries to build on a needs_attention verdict and proceeds to publish on ship', async () => {
    const ctx = await unitCtx();
    const dir = unitDirFor(ctx, 'PL-1');
    writeState(dir, { ...readState(dir), stage: 'review' });
    await dispatch(unitTool, { action: 'report', id: 'PL-1', stage: 'review', outcome: 'done', summary: 'two majors', verdict: 'needs_attention' }, ctx);
    const retry = await dispatch(unitTool, { action: 'route', id: 'PL-1' }, ctx);
    expect(retry.envelope.data).toMatchObject({ decision: 'retry', next: 'build', verdict: 'needs_attention' });
    expect(readState(dir).stage).toBe('build');
    writeState(dir, { ...readState(dir), stage: 'review' });
    await dispatch(unitTool, { action: 'report', id: 'PL-1', stage: 'review', outcome: 'done', summary: 'clean', verdict: 'ship' }, ctx);
    const onward = await dispatch(unitTool, { action: 'route', id: 'PL-1' }, ctx);
    expect(onward.envelope.data).toMatchObject({ decision: 'proceed', next: 'publish' });
    expect(readState(dir).stage).toBe('publish');
  });

  it('rejects a report for a stage other than the current one', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(unitTool, { action: 'report', id: 'PL-1', stage: 'publish', outcome: 'done', summary: 'x' }, ctx);
    expect(r.envelope.ok).toBe(false);
  });
});

describe('pilot brief', () => {
  it('renders the dispatch template, standing-rules pointer, route call and checkpoint rules', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(unitTool, { action: 'brief', id: 'PL-1', stage: 'pilot' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('# pilot');
    expect(r.text).toContain('@root/skills/_shared/standing-rules.md');
    expect(r.text).toContain('@root/skills/scope/SKILL.md');
    expect(r.text).toContain('"quiet": true');
    expect(r.text).toContain('unit report');
    expect(r.text).toContain('unit route');
    expect(r.text).toContain('unit answer');
    expect(r.text).toMatch(/checkpoint/i);
    expect(r.text).toContain('PL-1');
  });
});
