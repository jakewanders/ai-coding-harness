import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../src/registry/tools.js';
import { indexPath, readIndex, tokenize } from '../../src/store/index.js';
import { unitDirFor } from '../../src/store/units.js';
import { digestTool } from '../../src/tools/digest.js';
import { recallTool } from '../../src/tools/recall.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

async function seeded() {
  const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'RC-1' }, ctx);
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'RC-2' }, ctx);
  await dispatch(digestTool, { action: 'write', id: 'RC-1', summary: 'Login redirect fixed.', decisions: ['Switched to a streaming CSV writer for exports'], tags: ['auth'] }, ctx);
  await dispatch(digestTool, { action: 'write', id: 'RC-2', summary: 'Rate limiting added to the API.', decisions: ['Token bucket per client'], tags: ['api'] }, ctx);
  return ctx;
}

describe('tokenize', () => {
  it('lowercases, splits on non-alphanumerics, drops stopwords and short tokens, dedupes', () => {
    expect(tokenize('The Streaming CSV-writer, for the exports!')).toEqual(['streaming', 'csv', 'writer', 'exports']);
    expect(tokenize('')).toEqual([]);
  });
});

describe('recall search', () => {
  it('finds a unit by a decision keyword and ranks by overlap', async () => {
    const ctx = await seeded();
    const r = await dispatch(recallTool, { action: 'search', query: 'streaming csv' }, ctx);
    expect(r.envelope.ok).toBe(true);
    const hits = (r.envelope.data as { hits: Array<{ id: string; score: number }> }).hits;
    expect(hits[0]!.id).toBe('RC-1');
    expect(hits[0]!.score).toBeGreaterThan(0);
    expect(hits.some((h) => h.id === 'RC-2')).toBe(false);
    const both = await dispatch(recallTool, { action: 'search', query: 'token bucket redirect' }, ctx);
    expect((both.envelope.data as { hits: Array<{ id: string }> }).hits.map((h) => h.id).sort()).toEqual(['RC-1', 'RC-2']);
    const limited = await dispatch(recallTool, { action: 'search', query: 'token bucket redirect', limit: 1 }, ctx);
    expect((limited.envelope.data as { hits: unknown[] }).hits).toHaveLength(1);
    const none = await dispatch(recallTool, { action: 'search', query: 'kubernetes' }, ctx);
    expect((none.envelope.data as { hits: unknown[] }).hits).toEqual([]);
    expect(none.text).toMatch(/no matches/i);
  });

  it('filters by repo namespace', async () => {
    const ctx = await seeded();
    const other = await dispatch(recallTool, { action: 'search', query: 'redirect', repo: 'local/elsewhere' }, ctx);
    expect((other.envelope.data as { hits: unknown[] }).hits).toEqual([]);
  });

  it('matches on tags too', async () => {
    const ctx = await seeded();
    const r = await dispatch(recallTool, { action: 'search', query: 'auth' }, ctx);
    expect((r.envelope.data as { hits: Array<{ id: string }> }).hits.map((h) => h.id)).toEqual(['RC-1']);
  });
});

describe('recall reindex', () => {
  it('rebuilds the index from digest.md files after the index is deleted', async () => {
    const ctx = await seeded();
    fs.rmSync(indexPath(ctx.vault));
    expect(readIndex(ctx.vault).entries).toEqual([]);
    const r = await dispatch(recallTool, { action: 'reindex' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toMatchObject({ indexed: 2 });
    const entries = readIndex(ctx.vault).entries;
    expect(entries.map((e) => e.id).sort()).toEqual(['RC-1', 'RC-2']);
    expect(entries.find((e) => e.id === 'RC-1')!.decisions).toEqual(['Switched to a streaming CSV writer for exports']);
    const again = await dispatch(recallTool, { action: 'search', query: 'streaming' }, ctx);
    expect((again.envelope.data as { hits: Array<{ id: string }> }).hits[0]!.id).toBe('RC-1');
    expect(fs.existsSync(path.join(unitDirFor(ctx, 'RC-1'), 'digest.md'))).toBe(true);
  });
});
