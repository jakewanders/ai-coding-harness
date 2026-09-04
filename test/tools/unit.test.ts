import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { HeaderSchema } from '../../src/contracts/header.js';
import { defineGate, registerGate, allGates } from '../../src/registry/gates.js';
import { dispatch } from '../../src/registry/tools.js';
import { STAGES } from '../../src/registry/stages.js';
import { namespaceFor, unitDirFor } from '../../src/store/units.js';
import { readState, writeState, type UnitState } from '../../src/store/state.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

function ctxInRepo() {
  const cwd = makeRepo({ 'README.md': 'x' });
  return makeCtx({ cwd });
}

function headerOf(text: string): unknown {
  const m = /```yaml\n([\s\S]*?)\n```/.exec(text);
  expect(m, 'brief has a yaml header').not.toBeNull();
  return parseYaml(m![1]!);
}

describe('unit start', () => {
  it('creates an untracked unit from text with a synthetic id and pins the text', async () => {
    const ctx = ctxInRepo();
    const r = await dispatch(unitTool, { action: 'start', source: 'text', text: 'Fix the login redirect loop.' }, ctx);
    expect(r.envelope.ok).toBe(true);
    const data = r.envelope.data as { id: string; tracked: boolean; stage: string };
    expect(data.id).toMatch(/^local-[0-9a-f]{8}$/);
    expect(data.tracked).toBe(false);
    expect(data.stage).toBe('scope');
    const dir = unitDirFor(ctx, data.id);
    expect(fs.readFileSync(path.join(dir, 'source.md'), 'utf8')).toBe('Fix the login redirect loop.');
    const state = readState(dir);
    expect(state.source).toEqual({ kind: 'text', ref: null, pinned: true });
    expect(state.timers).toHaveLength(1);
    expect(state.timers[0]).toMatchObject({ stage: 'scope', ended_at: null });
    expect(r.envelope.next).toEqual([{ tool: 'unit', action: 'brief', why: expect.stringContaining(data.id) }]);
    expect(fs.existsSync(path.join(dir, 'history.md'))).toBe(true);
  });

  it('creates a tracked unit when an id is given, and for ticket sources', async () => {
    const ctx = ctxInRepo();
    const a = await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-1', text: 'thing' }, ctx);
    expect(a.envelope.data).toMatchObject({ id: 'ABC-1', tracked: true });
    const b = await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'ABC-2' }, ctx);
    expect(b.envelope.data).toMatchObject({ id: 'ABC-2', tracked: true });
    expect(readState(unitDirFor(ctx, 'ABC-2')).source).toEqual({ kind: 'ticket', ref: 'ABC-2', pinned: false });
  });

  it('refuses a duplicate id, an unknown mode, and a ticket without a ref', async () => {
    const ctx = ctxInRepo();
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-1', text: 'thing' }, ctx);
    const dup = await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-1', text: 'thing' }, ctx);
    expect(dup.envelope.ok).toBe(false);
    expect(dup.envelope.summary).toContain('exists');
    const mode = await dispatch(unitTool, { action: 'start', source: 'text', text: 'x', mode: 'nope' }, ctx);
    expect(mode.envelope.ok).toBe(false);
    expect(mode.envelope.summary).toContain('nope');
    const noref = await dispatch(unitTool, { action: 'start', source: 'ticket' }, ctx);
    expect(noref.envelope.ok).toBe(false);
  });

  it('pins a file source from disk', async () => {
    const ctx = ctxInRepo();
    const file = path.join(ctx.cwd, 'req.md');
    fs.writeFileSync(file, '# Requirement\n\nDo it.\n');
    const r = await dispatch(unitTool, { action: 'start', source: 'file', ref: file }, ctx);
    expect(r.envelope.ok).toBe(true);
    const { id } = r.envelope.data as { id: string };
    expect(fs.readFileSync(path.join(unitDirFor(ctx, id), 'source.md'), 'utf8')).toBe('# Requirement\n\nDo it.\n');
  });
});

describe('unit status and list', () => {
  it('renders the one-line status and lists units in the namespace', async () => {
    const ctx = ctxInRepo();
    const empty = await dispatch(unitTool, { action: 'list' }, ctx);
    expect(empty.envelope.ok).toBe(true);
    expect(empty.envelope.data).toEqual({ namespace: namespaceFor(ctx.cwd), units: [] });
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-1', text: 'a', mode: 'sketch' }, ctx);
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-2', text: 'b' }, ctx);
    const status = await dispatch(unitTool, { action: 'status', id: 'ABC-1' }, ctx);
    expect(status.text.split('\n')[0]).toBe('ABC-1 · scope · cycle 0 · sketch · no branch');
    const list = await dispatch(unitTool, { action: 'list' }, ctx);
    const units = (list.envelope.data as { units: Array<{ id: string }> }).units;
    expect(units.map((u) => u.id).sort()).toEqual(['ABC-1', 'ABC-2']);
    const missing = await dispatch(unitTool, { action: 'status', id: 'ZZZ-9' }, ctx);
    expect(missing.envelope.ok).toBe(false);
  });
});

describe('unit brief', () => {
  it('opens with a valid header, seat block, source block, stage material and the stop banner', async () => {
    const ctx = ctxInRepo();
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-1', text: 'Pinned requirement text.' }, ctx);
    const r = await dispatch(unitTool, { action: 'brief', id: 'ABC-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text.startsWith('```yaml\ncontract: harness-brief/1\n')).toBe(true);
    const header = HeaderSchema.parse(headerOf(r.text));
    expect(header).toMatchObject({ unit: 'ABC-1', stage: 'scope', mode: 'thorough', repo: namespaceFor(ctx.cwd), root: ctx.root });
    expect(header.seats.tracker).toBe('unwired');
    expect(r.text).toContain('unwired — skip steps that need it and say so');
    expect(r.text).toContain('Pinned requirement text.');
    expect(r.text).toContain('# scope');
    expect(r.text).toContain('Stop after this stage and report to the user.');
  });

  it('omits the banner when quiet and reports no pinned source for ticket units', async () => {
    const ctx = ctxInRepo();
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'ABC-3' }, ctx);
    const r = await dispatch(unitTool, { action: 'brief', id: 'ABC-3', quiet: true }, ctx);
    expect(r.text).not.toContain('Stop after this stage and report to the user.');
    expect(r.text).toContain('no pinned source');
  });

  it('renders an explicit stage, surfaces config errors, and fails for an unknown unit or stage', async () => {
    const ctx = ctxInRepo();
    fs.writeFileSync(path.join(ctx.cwd, '.harness.yaml'), 'schema: 1\nrepos:\n  x:\n    bogus: 1\n');
    const ctx2 = makeCtx({ cwd: ctx.cwd });
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-1', text: 'a' }, ctx2);
    const r = await dispatch(unitTool, { action: 'brief', id: 'ABC-1', stage: 'build' }, ctx2);
    expect(r.text).toContain('# build');
    const header = HeaderSchema.parse(headerOf(r.text));
    expect(header.stage).toBe('build');
    expect(header.config_errors).toHaveLength(1);
    expect(r.text).toContain('repos.x.bogus');
    expect((await dispatch(unitTool, { action: 'brief', id: 'NOPE-1' }, ctx2)).envelope.ok).toBe(false);
    expect((await dispatch(unitTool, { action: 'brief', id: 'ABC-1', stage: 'nowhere' }, ctx2)).envelope.ok).toBe(false);
  });

  it('renders standalone flows without a unit', async () => {
    const ctx = ctxInRepo();
    const r = await dispatch(unitTool, { action: 'brief', stage: 'setup' }, ctx);
    expect(r.envelope.ok).toBe(true);
    const header = HeaderSchema.parse(headerOf(r.text));
    expect(header.stage).toBe('setup');
    expect(r.text).toContain('# setup');
    const core = await dispatch(unitTool, { action: 'brief', stage: 'build' }, ctx);
    expect(core.envelope.ok).toBe(false);
  });
});

describe('unit advance', () => {
  it('moves scope to build when no gates apply and records timers and history', async () => {
    const ctx = ctxInRepo();
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-1', text: 'a' }, ctx);
    const r = await dispatch(unitTool, { action: 'advance', id: 'ABC-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toMatchObject({ from: 'scope', to: 'build', cycle: 0 });
    const state = readState(unitDirFor(ctx, 'ABC-1'));
    expect(state.stage).toBe('build');
    expect(state.timers.map((t) => t.stage)).toEqual(['scope', 'build']);
    expect(state.timers[0]!.ended_at).not.toBeNull();
    expect(state.timers[1]!.ended_at).toBeNull();
    expect(fs.readFileSync(path.join(unitDirFor(ctx, 'ABC-1'), 'history.md'), 'utf8')).toMatch(/scope.*build/);
    expect(r.envelope.next[0]).toMatchObject({ tool: 'unit', action: 'brief' });
  });

  it('refuses when a blocking gate fails and reports the remedy', async () => {
    const ctx = ctxInRepo();
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'GATED-1', text: 'a' }, ctx);
    if (!allGates().some((g) => g.id === 'test_block_plan')) {
      registerGate(defineGate({
        id: 'test_block_plan', stage: 'build', description: 'test gate scoped to GATED-1', severity: 'block',
        check: (g) => (g.state.id !== 'GATED-1' || g.state.answers.unblock === 'yes' ? { pass: true } : { pass: false, remedy: 'answer unblock=yes' }),
      }));
    }
    await dispatch(unitTool, { action: 'advance', id: 'GATED-1' }, ctx);
    const blocked = await dispatch(unitTool, { action: 'advance', id: 'GATED-1' }, ctx);
    expect(blocked.envelope.ok).toBe(false);
    expect(blocked.text).toContain('answer unblock=yes');
    expect((blocked.envelope.data as { blocking: Array<{ id: string }> }).blocking.map((g) => g.id)).toContain('test_block_plan');
    expect(readState(unitDirFor(ctx, 'GATED-1')).stage).toBe('build');
  });

  it('honours an explicit target, skips stages per mode, and increments the cycle when review starts again', async () => {
    const ctx = ctxInRepo();
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-1', text: 'a', mode: 'sketch' }, ctx);
    expect((await dispatch(unitTool, { action: 'advance', id: 'ABC-1', to: 'build' }, ctx)).envelope.ok).toBe(true);
    satisfyBuildGates(unitDirFor(ctx, 'ABC-1'));
    const r = await dispatch(unitTool, { action: 'advance', id: 'ABC-1' }, ctx);
    expect(r.envelope.data).toMatchObject({ from: 'build', to: 'publish' });
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-2', text: 'b' }, ctx);
    expect((await dispatch(unitTool, { action: 'advance', id: 'ABC-2', to: 'build' }, ctx)).envelope.ok).toBe(true);
    satisfyBuildGates(unitDirFor(ctx, 'ABC-2'));
    expect((await dispatch(unitTool, { action: 'advance', id: 'ABC-2', to: 'review' }, ctx)).envelope.ok).toBe(true);
    expect(readState(unitDirFor(ctx, 'ABC-2')).cycle).toBe(0);
    expect((await dispatch(unitTool, { action: 'advance', id: 'ABC-2', to: 'build' }, ctx)).envelope.ok).toBe(true);
    satisfyBuildGates(unitDirFor(ctx, 'ABC-2'));
    const again = await dispatch(unitTool, { action: 'advance', id: 'ABC-2', to: 'review' }, ctx);
    expect(again.envelope.data).toMatchObject({ from: 'build', to: 'review', cycle: 1 });
    const bad = await dispatch(unitTool, { action: 'advance', id: 'ABC-2', to: 'nowhere' }, ctx);
    expect(bad.envelope.ok).toBe(false);
  });

});

/** Give a unit the evidence and green run the real build gates require in its current cycle. */
function satisfyBuildGates(dir: string) {
  const s: UnitState = readState(dir);
  const at = '2026-09-04T00:00:00.000Z';
  writeState(dir, {
    ...s,
    evidence: [...s.evidence, { kind: 'self_critique', cycle: s.cycle, recorded_at: at, payload: { findings: [] } }, { kind: 'pii', cycle: s.cycle, recorded_at: at, payload: { findings: [] } }],
    runs: [...s.runs, { id: `r-${s.cycle}`, command: 'true', exit: 0, summary: '', log: '~/l.log', started_at: at, ended_at: at, cycle: s.cycle }],
  });
}

describe('STAGES coverage', () => {
  it('every registered stage has a brief renderer that names itself', async () => {
    const ctx = ctxInRepo();
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'ABC-1', text: 'a' }, ctx);
    for (const s of STAGES) {
      const r = await dispatch(unitTool, { action: 'brief', id: 'ABC-1', stage: s.name, quiet: true }, ctx);
      expect(r.envelope.ok, s.name).toBe(true);
      expect(r.text, s.name).toContain(`# ${s.name}`);
    }
  });
});
