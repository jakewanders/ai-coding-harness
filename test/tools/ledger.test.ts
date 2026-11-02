import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../src/registry/tools.js';
import { ledgerPath, readLedger } from '../../src/store/ledger.js';
import { readState, writeState } from '../../src/store/state.js';
import { namespaceFor, unitDirFor } from '../../src/store/units.js';
import { evidenceTool } from '../../src/tools/evidence.js';
import { ledgerTool } from '../../src/tools/ledger.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

async function ctxWithUnits(ids = ['LG-1', 'LG-2']) {
  const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
  for (const id of ids) await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id }, ctx);
  return ctx;
}

async function gate(ctx: ReturnType<typeof makeCtx>, id: string) {
  const dir = unitDirFor(ctx, id);
  writeState(dir, { ...readState(dir), stage: 'review' });
  const r = await dispatch(evidenceTool, { action: 'check', id, gate: 'ledger_reverified' }, ctx);
  return r.envelope.data as { status: string; severity: string; remedy?: string };
}

describe('ledger add and list', () => {
  it('adds entries to the repo ledger and lists them, filtered by status', async () => {
    const ctx = await ctxWithUnits();
    const ns = namespaceFor(ctx.cwd);
    const a = await dispatch(ledgerTool, { action: 'add', kind: 'ask', text: 'Keep the export CSV header stable', id: 'LG-1' }, ctx);
    expect(a.envelope.ok).toBe(true);
    expect(a.envelope.data).toMatchObject({ entry: { id: 'L-1', repo: ns, kind: 'ask', text: 'Keep the export CSV header stable', origin_unit: 'LG-1', status: 'open', created_at: '2026-09-04T12:00:00.000Z' } });
    const b = await dispatch(ledgerTool, { action: 'add', kind: 'landing', text: 'Auth middleware now rejects expired tokens' }, ctx);
    expect((b.envelope.data as { entry: { id: string; origin_unit: string | null } }).entry).toMatchObject({ id: 'L-2', origin_unit: null });
    expect(fs.existsSync(ledgerPath(ctx.vault, ns))).toBe(true);
    const all = await dispatch(ledgerTool, { action: 'list' }, ctx);
    expect((all.envelope.data as { entries: unknown[] }).entries).toHaveLength(2);
    expect(all.text).toContain('Keep the export CSV header stable');
    const other = await dispatch(ledgerTool, { action: 'list', repo: 'local/elsewhere' }, ctx);
    expect((other.envelope.data as { entries: unknown[] }).entries).toEqual([]);
    await dispatch(ledgerTool, { action: 'close', entry: 'L-2', reason: 'superseded' }, ctx);
    const open = await dispatch(ledgerTool, { action: 'list', status: 'open' }, ctx);
    expect((open.envelope.data as { entries: Array<{ id: string }> }).entries.map((e) => e.id)).toEqual(['L-1']);
    expect(readLedger(ctx.vault, ns).entries.find((e) => e.id === 'L-2')).toMatchObject({ status: 'closed', closed_reason: 'superseded' });
  });

  it('rejects unknown entries', async () => {
    const ctx = await ctxWithUnits();
    expect((await dispatch(ledgerTool, { action: 'recheck', entry: 'L-9', id: 'LG-1' }, ctx)).envelope.ok).toBe(false);
    expect((await dispatch(ledgerTool, { action: 'close', entry: 'L-9', reason: 'x' }, ctx)).envelope.ok).toBe(false);
  });
});

describe('ledger_reverified gate', () => {
  it('passes on an empty ledger, fails with open entries, and recheck flips it for that unit only', async () => {
    const ctx = await ctxWithUnits();
    expect(await gate(ctx, 'LG-1')).toMatchObject({ status: 'pass', severity: 'warn' });
    await dispatch(ledgerTool, { action: 'add', kind: 'ask', text: 'Keep the export CSV header stable', id: 'LG-1' }, ctx);
    const failing = await gate(ctx, 'LG-1');
    expect(failing.status).toBe('fail');
    expect(failing.remedy).toContain('L-1');
    const r = await dispatch(ledgerTool, { action: 'recheck', entry: 'L-1', id: 'LG-1', note: 'header unchanged in this diff' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect((r.envelope.data as { entry: { status: string; last_checked_unit: string; notes: string[] } }).entry).toMatchObject({ status: 'rechecked', last_checked_unit: 'LG-1', notes: ['LG-1: header unchanged in this diff'] });
    expect(await gate(ctx, 'LG-1')).toMatchObject({ status: 'pass' });
    expect(await gate(ctx, 'LG-2')).toMatchObject({ status: 'fail' });
    await dispatch(ledgerTool, { action: 'recheck', entry: 'L-1', id: 'LG-2' }, ctx);
    expect(await gate(ctx, 'LG-2')).toMatchObject({ status: 'pass' });
    expect(await gate(ctx, 'LG-1')).toMatchObject({ status: 'fail' });
  });

  it('ignores closed entries', async () => {
    const ctx = await ctxWithUnits();
    await dispatch(ledgerTool, { action: 'add', kind: 'landing', text: 'old', id: 'LG-1' }, ctx);
    await dispatch(ledgerTool, { action: 'close', entry: 'L-1', reason: 'done' }, ctx);
    expect(await gate(ctx, 'LG-2')).toMatchObject({ status: 'pass' });
  });
});

describe('briefs', () => {
  it('define and review briefs list the open ledger entries', async () => {
    const ctx = await ctxWithUnits();
    await dispatch(ledgerTool, { action: 'add', kind: 'ask', text: 'Keep the export CSV header stable', id: 'LG-1' }, ctx);
    await dispatch(ledgerTool, { action: 'add', kind: 'landing', text: 'Closed thing' }, ctx);
    await dispatch(ledgerTool, { action: 'close', entry: 'L-2', reason: 'done' }, ctx);
    for (const stage of ['define', 'review']) {
      const r = await dispatch(unitTool, { action: 'brief', id: 'LG-2', stage, quiet: true }, ctx);
      expect(r.text, stage).toContain('## Ledger');
      expect(r.text, stage).toContain('Keep the export CSV header stable');
      expect(r.text, stage).not.toContain('Closed thing');
    }
    const prBrief = await dispatch(unitTool, { action: 'brief', id: 'LG-2', stage: 'pr', quiet: true }, ctx);
    expect(prBrief.text).not.toContain('## Ledger');
    expect(fs.existsSync(path.join(unitDirFor(ctx, 'LG-2'), 'state.json'))).toBe(true);
  });
});
