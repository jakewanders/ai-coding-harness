import { describe, expect, it } from 'vitest';
import { EVIDENCE_KINDS, EVIDENCE_KIND_NAMES, type EvidenceKind } from '../../src/evidence/kinds.js';
import { resolveGates } from '../../src/registry/gates.js';
import { resolveMode } from '../../src/modes.js';
import { dispatch } from '../../src/registry/tools.js';
import { readState, writeState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { evidenceTool } from '../../src/tools/evidence.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

async function unitCtx(id = 'EVI-1') {
  const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id }, ctx);
  return ctx;
}

const finding = { severity: 'major', text: 'x', addressed: false };

/** One valid and one invalid payload per kind. */
const SAMPLES: Record<EvidenceKind, { valid: unknown; invalid: unknown }> = {
  self_critique: { valid: { findings: [finding] }, invalid: { findings: [{ severity: 'huge', text: 'x', addressed: false }] } },
  defect_repro: { valid: { test_location: 'test/a.test.ts', command: 'npm test', red_output: 'FAIL 1' }, invalid: { test_location: 'x', command: 'y' } },
  screen_verdict: { valid: { dimension: 'technical', model: 'primary', verdict: 'valid', reasons: ['clear'] }, invalid: { dimension: 'technical', model: 'primary', verdict: 'maybe', reasons: [] } },
  pii: { valid: { findings: [{ file: 'src/a.ts', line: 3, sink: 'log', text: 'email' }] }, invalid: { findings: [{ file: 'src/a.ts', line: 3, sink: 'tv', text: 'x' }] } },
  criteria_validation: { valid: { results: [{ criterion: 'AC-1', status: 'proven', proof: 'test x' }] }, invalid: { results: [{ criterion: 'AC-1', status: 'kinda' }] } },
  claims: { valid: { claims: [{ text: 'faster', status: 'verified', evidence: 'bench' }] }, invalid: { claims: [{ text: 'faster' }] } },
  waiver: { valid: { gate: 'pii_audit_clean', rationale: 'test fixture data only' }, invalid: { gate: 'pii_audit_clean' } },
  browser_findings: { valid: { criteria: [{ id: 'AC-1', result: 'pass', notes: 'ok', screenshots: [] }], runtime_errors: [], e2e: null, out_of_scope: [] }, invalid: { criteria: [{ id: 'AC-1', result: 'meh', notes: '', screenshots: [] }], runtime_errors: [], e2e: null, out_of_scope: [] } },
  review_column: { valid: { column: 'adversarial', findings: [{ severity: 'blocker', text: 'x', path: 'src/a.ts', line: 1 }] }, invalid: { column: 'vibes', findings: [] } },
};

describe('EVIDENCE_KINDS', () => {
  it('defines a concrete schema, remedy and description for every kind', () => {
    expect(Object.keys(EVIDENCE_KINDS).sort()).toEqual([...EVIDENCE_KIND_NAMES].sort());
    for (const kind of EVIDENCE_KIND_NAMES) {
      const def = EVIDENCE_KINDS[kind];
      expect(def.remedy.length, kind).toBeGreaterThan(10);
      expect(def.describe.length, kind).toBeGreaterThan(10);
      expect(def.schema.safeParse(SAMPLES[kind].valid).success, `${kind} valid`).toBe(true);
      expect(def.schema.safeParse(SAMPLES[kind].invalid).success, `${kind} invalid`).toBe(false);
      expect(def.schema.safeParse('not an object').success, kind).toBe(false);
    }
  });

  it('accepts explicit empty findings lists', () => {
    expect(EVIDENCE_KINDS.self_critique.schema.safeParse({ findings: [] }).success).toBe(true);
    expect(EVIDENCE_KINDS.pii.schema.safeParse({ findings: [] }).success).toBe(true);
  });
});

describe('evidence record', () => {
  it('records every valid payload with the current cycle and rejects invalid ones with the remedy', async () => {
    const ctx = await unitCtx();
    for (const kind of EVIDENCE_KIND_NAMES) {
      const ok = await dispatch(evidenceTool, { action: 'record', id: 'EVI-1', kind, payload: SAMPLES[kind].valid }, ctx);
      expect(ok.envelope.ok, `${kind}: ${ok.envelope.summary}`).toBe(true);
      const bad = await dispatch(evidenceTool, { action: 'record', id: 'EVI-1', kind, payload: SAMPLES[kind].invalid }, ctx);
      expect(bad.envelope.ok, kind).toBe(false);
      expect(bad.envelope.summary, kind).toContain(EVIDENCE_KINDS[kind].remedy);
    }
    const state = readState(unitDirFor(ctx, 'EVI-1'));
    expect(state.evidence).toHaveLength(EVIDENCE_KIND_NAMES.length);
    expect(state.evidence.every((e) => e.cycle === 0)).toBe(true);
    expect(state.evidence[0]!.recorded_at).toBe('2026-09-04T12:00:00.000Z');
  });

  it('rejects an unknown kind at validation', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(evidenceTool, { action: 'record', id: 'EVI-1', kind: 'vibes', payload: {} }, ctx);
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.summary).toContain('kind');
  });
});

describe('evidence list', () => {
  it('filters by kind and cycle', async () => {
    const ctx = await unitCtx();
    await dispatch(evidenceTool, { action: 'record', id: 'EVI-1', kind: 'self_critique', payload: { findings: [] } }, ctx);
    await dispatch(evidenceTool, { action: 'record', id: 'EVI-1', kind: 'pii', payload: { findings: [] } }, ctx);
    const dir = unitDirFor(ctx, 'EVI-1');
    writeState(dir, { ...readState(dir), cycle: 1 });
    await dispatch(evidenceTool, { action: 'record', id: 'EVI-1', kind: 'self_critique', payload: { findings: [finding] } }, ctx);
    const all = await dispatch(evidenceTool, { action: 'list', id: 'EVI-1' }, ctx);
    expect((all.envelope.data as { records: unknown[] }).records).toHaveLength(3);
    const critiques = await dispatch(evidenceTool, { action: 'list', id: 'EVI-1', kind: 'self_critique' }, ctx);
    expect((critiques.envelope.data as { records: unknown[] }).records).toHaveLength(2);
    const cycle1 = await dispatch(evidenceTool, { action: 'list', id: 'EVI-1', cycle: 1 }, ctx);
    expect((cycle1.envelope.data as { records: Array<{ kind: string }> }).records.map((r) => r.kind)).toEqual(['self_critique']);
  });
});

describe('evidence gates and check', () => {
  it('reports the same statuses as resolveGates and checks a single gate', async () => {
    const ctx = await unitCtx();
    const dir = unitDirFor(ctx, 'EVI-1');
    writeState(dir, { ...readState(dir), stage: 'build', kind: 'bug' });
    await dispatch(evidenceTool, { action: 'record', id: 'EVI-1', kind: 'self_critique', payload: { findings: [] } }, ctx);
    const viaTool = await dispatch(evidenceTool, { action: 'gates', id: 'EVI-1' }, ctx);
    expect(viaTool.envelope.ok).toBe(true);
    const state = readState(dir);
    const direct = await resolveGates('build', { state, config: ctx.config.config, unitDir: dir, worktree: null }, resolveMode('thorough', ctx.config.config));
    const toolGates = (viaTool.envelope.data as { gates: Array<{ id: string; status: string; severity: string }> }).gates;
    expect(toolGates.map((g) => [g.id, g.severity, g.status])).toEqual(direct.map((g) => [g.id, g.severity, g.status]));
    expect(toolGates.find((g) => g.id === 'self_critique_recorded')!.status).toBe('pass');
    expect(toolGates.find((g) => g.id === 'defect_repro_before_fix')!.status).toBe('fail');
    const explicit = await dispatch(evidenceTool, { action: 'gates', id: 'EVI-1', stage: 'close' }, ctx);
    expect((explicit.envelope.data as { gates: Array<{ id: string }> }).gates.map((g) => g.id)).toEqual(['pr_recorded']);
    const one = await dispatch(evidenceTool, { action: 'check', id: 'EVI-1', gate: 'pii_audit_clean' }, ctx);
    expect(one.envelope.ok).toBe(false);
    expect(one.envelope.data).toMatchObject({ id: 'pii_audit_clean', status: 'fail' });
    expect(one.text).toContain('pii');
    const unknown = await dispatch(evidenceTool, { action: 'check', id: 'EVI-1', gate: 'nope' }, ctx);
    expect(unknown.envelope.ok).toBe(false);
  });
});
