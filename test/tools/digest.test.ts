import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../src/registry/tools.js';
import { readIndex } from '../../src/store/index.js';
import { readState, writeState, type TimerRecord } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { digestTool } from '../../src/tools/digest.js';
import { pullreqTool } from '../../src/tools/pullreq.js';
import { specTool } from '../../src/tools/spec.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

async function unitCtx(mode = 'thorough', id = 'DG-1') {
  const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id, mode }, ctx);
  await dispatch(specTool, { action: 'record', id, title: 'Export button', body: 'Add an export button.' }, ctx);
  await dispatch(specTool, { action: 'criteria', id, set: ['Button visible', 'CSV downloads'] }, ctx);
  return ctx;
}

describe('digest write / get', () => {
  it('writes digest.md and an index entry with tokens', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(digestTool, { action: 'write', id: 'DG-1', summary: 'Shipped the export button.', decisions: ['Used streaming CSV writer', 'Deferred Excel'], tags: ['export', 'csv'] }, ctx);
    expect(r.envelope.ok).toBe(true);
    const md = fs.readFileSync(path.join(unitDirFor(ctx, 'DG-1'), 'digest.md'), 'utf8');
    expect(md).toContain('Shipped the export button.');
    expect(md).toContain('Used streaming CSV writer');
    const index = readIndex(ctx.vault);
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]).toMatchObject({ id: 'DG-1', repo: readState(unitDirFor(ctx, 'DG-1')).repo, tags: ['export', 'csv'] });
    expect(index.entries[0]!.tokens).toEqual(expect.arrayContaining(['streaming', 'csv', 'export', 'excel']));
    const got = await dispatch(digestTool, { action: 'get', id: 'DG-1' }, ctx);
    expect(got.envelope.data).toMatchObject({ digest: { summary: 'Shipped the export button.', decisions: ['Used streaming CSV writer', 'Deferred Excel'], tags: ['export', 'csv'] } });
    await dispatch(digestTool, { action: 'write', id: 'DG-1', summary: 'Updated.', decisions: [] }, ctx);
    expect(readIndex(ctx.vault).entries).toHaveLength(1);
    expect(readIndex(ctx.vault).entries[0]!.summary).toBe('Updated.');
  });

  it('get reports no digest for a bare unit', async () => {
    const ctx = await unitCtx();
    const got = await dispatch(digestTool, { action: 'get', id: 'DG-1' }, ctx);
    expect(got.envelope.ok).toBe(true);
    expect(got.envelope.data).toMatchObject({ digest: null });
  });
});

describe('digest history', () => {
  it('appends a line when given and returns the history otherwise', async () => {
    const ctx = await unitCtx();
    const add = await dispatch(digestTool, { action: 'history', id: 'DG-1', line: 'decided to stream' }, ctx);
    expect(add.envelope.ok).toBe(true);
    const all = await dispatch(digestTool, { action: 'history', id: 'DG-1' }, ctx);
    const lines = (all.envelope.data as { lines: string[] }).lines;
    expect(lines.some((l) => l.includes('unit started'))).toBe(true);
    expect(lines.at(-1)).toMatch(/decided to stream$/);
  });
});

describe('digest handoff', () => {
  it('renders where things stand, questions and the next action, saved under drafts/', async () => {
    const ctx = await unitCtx();
    await dispatch(unitTool, { action: 'advance', id: 'DG-1' }, ctx);
    await dispatch(digestTool, { action: 'write', id: 'DG-1', summary: 'Halfway.', decisions: ['Streaming'] }, ctx);
    const r = await dispatch(digestTool, { action: 'handoff', id: 'DG-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('# Handoff');
    expect(r.text).toMatch(/where things stand/i);
    expect(r.text).toContain('plan');
    expect(r.text).toMatch(/open questions/i);
    expect(r.text).toMatch(/next action/i);
    expect(r.text).toContain('build');
    expect(r.text).toContain('Halfway.');
    const draft = path.join(unitDirFor(ctx, 'DG-1'), 'drafts', 'handoff.md');
    expect(fs.existsSync(draft)).toBe(true);
    expect(fs.readFileSync(draft, 'utf8')).toBe((r.envelope.data as { handoff: string }).handoff);
  });
});

describe('digest wrapup', () => {
  it('lists every timed stage, the PR link, the ledger, drafts and not-proven for reduced modes', async () => {
    const ctx = await unitCtx('express');
    const dir = unitDirFor(ctx, 'DG-1');
    const t = (stage: TimerRecord['stage'], start: string, end: string | null): TimerRecord => ({ stage, started_at: start, ended_at: end, idle_gaps_ms: 0 });
    const s = readState(dir);
    writeState(dir, {
      ...s,
      stage: 'publish',
      timers: [t('scope', '2026-09-04T09:00:00.000Z', '2026-09-04T09:30:00.000Z'), t('plan', '2026-09-04T09:30:00.000Z', '2026-09-04T10:00:00.000Z'), t('build', '2026-09-04T10:00:00.000Z', '2026-09-04T11:00:00.000Z'), t('commit', '2026-09-04T11:00:00.000Z', '2026-09-04T11:10:00.000Z'), t('publish', '2026-09-04T11:10:00.000Z', null)],
      commits: [{ sha: 'abc1234def', message: 'DG-1: export', at: '2026-09-04T11:05:00.000Z', cycle: 0 }],
    });
    await dispatch(pullreqTool, { action: 'record', id: 'DG-1', url: 'https://example.test/o/n/pull/9', number: 9, base: 'main', head: 'DG-1' }, ctx);
    fs.writeFileSync(path.join(dir, 'plan.md'), '# Plan\n\n## Deferred\n\n- Excel export\n');
    fs.writeFileSync(path.join(dir, 'drafts', 'comment-1.md'), 'held');
    const r = await dispatch(digestTool, { action: 'wrapup', id: 'DG-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('https://example.test/o/n/pull/9');
    for (const stage of ['scope', 'plan', 'build', 'commit', 'publish']) expect(r.text).toMatch(new RegExp(`\\| ${stage} \\|`));
    expect(r.text).toContain('abc1234');
    expect(r.text).toContain('AC-1');
    expect(r.text).toContain('AC-2');
    expect(r.text).toContain('Excel export');
    expect(r.text).toContain('comment-1.md');
    expect(r.text).toContain('## Not proven');
    expect((r.envelope.data as { stages: Array<{ stage: string }> }).stages.map((x) => x.stage)).toEqual(['scope', 'plan', 'build', 'commit', 'publish']);
  });

  it('says no PR and no drafts when there are none', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(digestTool, { action: 'wrapup', id: 'DG-1' }, ctx);
    expect(r.text).toMatch(/no pull request/i);
    expect(r.text).toMatch(/no held drafts/i);
    expect(r.text).not.toContain('## Not proven');
  });
});
