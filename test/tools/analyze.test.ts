import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../src/registry/tools.js';
import { readState, writeState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { analyzeTool } from '../../src/tools/analyze.js';
import { evidenceTool } from '../../src/tools/evidence.js';
import { specTool } from '../../src/tools/spec.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';
import { NEW_EXPORT_DIFF, PII_DIFF, ROUTE_DIFF } from '../analysis/fixtures.js';

async function unitCtx(files: Record<string, string> = { 'README.md': 'x' }, id = 'AN-1') {
  const ctx = makeCtx({ cwd: makeRepo(files) });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id }, ctx);
  await dispatch(specTool, { action: 'record', id, title: 'Format money', body: 'Amounts show two decimals.' }, ctx);
  await dispatch(specTool, { action: 'criteria', id, set: ['Money amounts are formatted with two decimals', 'Users receive a welcome notification'] }, ctx);
  return ctx;
}

async function gate(ctx: ReturnType<typeof makeCtx>, id: string, gateId: string) {
  const r = await dispatch(evidenceTool, { action: 'check', id, gate: gateId }, ctx);
  return (r.envelope.data as { status: string }).status;
}

describe('analyze impact', () => {
  it('computes consumers from the given diff, records impact evidence, and flips the gate', async () => {
    const ctx = await unitCtx({ 'src/util/format.ts': 'export function formatMoney() {}\n', 'src/cart.ts': "import { formatMoney } from './util/format.js';\n" });
    const dir = unitDirFor(ctx, 'AN-1');
    writeState(dir, { ...readState(dir), stage: 'review' });
    expect(await gate(ctx, 'AN-1', 'impact_recorded')).toBe('fail');
    const r = await dispatch(analyzeTool, { action: 'impact', id: 'AN-1', diff: NEW_EXPORT_DIFF }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toMatchObject({ changed_exports: [{ file: 'src/util/format.ts', name: 'formatMoney' }], consumers: [{ file: 'src/cart.ts', imports: ['formatMoney'] }] });
    const state = readState(dir);
    expect(state.evidence.filter((e) => e.kind === 'impact')).toHaveLength(1);
    expect(state.evidence[0]!.payload).toMatchObject({ changed: [{ path: 'src/util/format.ts', consumers: ['src/cart.ts'] }] });
    expect(r.envelope.next[0]).toMatchObject({ tool: 'evidence', action: 'check' });
    expect(r.envelope.next[0]!.why).toContain('impact_recorded');
    expect(await gate(ctx, 'AN-1', 'impact_recorded')).toBe('pass');
  });

  it('reads the diff from git when none is given', async () => {
    const ctx = await unitCtx({ 'README.md': 'x' });
    fs.writeFileSync(path.join(ctx.cwd, 'src.ts'), 'export const fresh = 1;\n');
    const r = await dispatch(analyzeTool, { action: 'impact', id: 'AN-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect((r.envelope.data as { changed_exports: Array<{ name: string }> }).changed_exports.map((e) => e.name)).toEqual(['fresh']);
  });
});

describe('analyze pii', () => {
  it('records findings and the gate stays failing until clean', async () => {
    const ctx = await unitCtx();
    const dir = unitDirFor(ctx, 'AN-1');
    writeState(dir, { ...readState(dir), stage: 'commit' });
    const dirty = await dispatch(analyzeTool, { action: 'pii', id: 'AN-1', diff: PII_DIFF }, ctx);
    expect(dirty.envelope.ok).toBe(false);
    expect((dirty.envelope.data as { findings: unknown[] }).findings).toHaveLength(2);
    expect(await gate(ctx, 'AN-1', 'pii_audit_clean')).toBe('fail');
    const clean = await dispatch(analyzeTool, { action: 'pii', id: 'AN-1', diff: NEW_EXPORT_DIFF }, ctx);
    expect(clean.envelope.ok).toBe(true);
    expect(await gate(ctx, 'AN-1', 'pii_audit_clean')).toBe('pass');
  });
});

describe('analyze claims', () => {
  it('extracts claims from the given text, records them, and flips claims_audited', async () => {
    const ctx = await unitCtx();
    const dir = unitDirFor(ctx, 'AN-1');
    writeState(dir, { ...readState(dir), stage: 'publish' });
    expect(await gate(ctx, 'AN-1', 'claims_audited')).toBe('fail');
    const r = await dispatch(analyzeTool, { action: 'claims', id: 'AN-1', text: 'This always retries. We moved a file.' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toMatchObject({ claims: [{ text: 'This always retries.', needs: 'test' }] });
    expect(await gate(ctx, 'AN-1', 'claims_audited')).toBe('pass');
    const state = readState(dir);
    expect(state.evidence.find((e) => e.kind === 'claims')!.payload).toMatchObject({ claims: [{ text: 'This always retries.', status: 'unverified' }] });
  });

  it('falls back to the drafted PR body when no text is given', async () => {
    const ctx = await unitCtx();
    const dir = unitDirFor(ctx, 'AN-1');
    fs.mkdirSync(path.join(dir, 'drafts'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'drafts', 'pr-body.md'), '# T\n\nThis fixes the loop.\n');
    const r = await dispatch(analyzeTool, { action: 'claims', id: 'AN-1' }, ctx);
    expect((r.envelope.data as { claims: Array<{ text: string }> }).claims.map((c) => c.text)).toEqual(['This fixes the loop.']);
  });
});

describe('analyze reach', () => {
  it('records surfaces with subjects and the gate fails while a surface is uncovered', async () => {
    const ctx = await unitCtx({ 'e2e/export.spec.ts': "request('/api/export')\n", 'README.md': 'x' });
    const dir = unitDirFor(ctx, 'AN-1');
    writeState(dir, { ...readState(dir), stage: 'review' });
    const r = await dispatch(analyzeTool, { action: 'reach', id: 'AN-1', diff: ROUTE_DIFF }, ctx);
    expect(r.envelope.ok).toBe(false);
    const surfaces = (r.envelope.data as { surfaces: Array<{ surface: string; covered_by: string[] }> }).surfaces;
    expect(surfaces.find((s) => s.surface === '/api/export')!.covered_by).toEqual(['e2e/export.spec.ts']);
    expect(surfaces.find((s) => s.surface === '/api/export/csv')!.covered_by).toEqual([]);
    expect(await gate(ctx, 'AN-1', 'reach_audit_recorded')).toBe('fail');
    const payload = readState(dir).evidence.find((e) => e.kind === 'reach_audit')!.payload as { surfaces: Array<{ surface: string; subjects: Array<{ kind: string; name: string; extended: boolean }> }> };
    expect(payload.surfaces.find((s) => s.surface === '/api/export')!.subjects).toEqual([{ kind: 'e2e', name: 'e2e/export.spec.ts', extended: true }]);
    const waived = payload.surfaces.map((s) => (s.subjects.length ? s : { ...s, waived: true, reason: 'internal helper, no external surface' }));
    await dispatch(evidenceTool, { action: 'record', id: 'AN-1', kind: 'reach_audit', payload: { surfaces: waived } }, ctx);
    expect(await gate(ctx, 'AN-1', 'reach_audit_recorded')).toBe('pass');
  });
});

describe('analyze criteria_map and criteria_validated', () => {
  it('maps criteria to hunks, records validation, and the gate requires every criterion proven', async () => {
    const ctx = await unitCtx();
    const dir = unitDirFor(ctx, 'AN-1');
    writeState(dir, { ...readState(dir), stage: 'publish' });
    expect(await gate(ctx, 'AN-1', 'criteria_validated')).toBe('fail');
    const r = await dispatch(analyzeTool, { action: 'criteria_map', id: 'AN-1', diff: NEW_EXPORT_DIFF + PII_DIFF }, ctx);
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.data).toMatchObject({ unproven: [{ id: 'AC-2' }], orphan_hunks: ['src/auth.ts'] });
    expect(await gate(ctx, 'AN-1', 'criteria_validated')).toBe('fail');
    await dispatch(evidenceTool, { action: 'record', id: 'AN-1', kind: 'criteria_validation', payload: { results: [{ criterion: 'AC-1', status: 'proven', proof: 'format.test.ts' }, { criterion: 'AC-2', status: 'proven', proof: 'notify.test.ts' }] } }, ctx);
    expect(await gate(ctx, 'AN-1', 'criteria_validated')).toBe('pass');
    await dispatch(evidenceTool, { action: 'record', id: 'AN-1', kind: 'criteria_validation', payload: { results: [{ criterion: 'AC-1', status: 'proven', proof: 'x' }] } }, ctx);
    expect(await gate(ctx, 'AN-1', 'criteria_validated')).toBe('fail');
  });
});
