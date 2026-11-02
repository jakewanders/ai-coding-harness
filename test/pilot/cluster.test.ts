import { describe, expect, it } from 'vitest';
import { cluster, jaccard, predictFiles } from '../../src/pilot/cluster.js';
import { dispatch } from '../../src/registry/tools.js';
import { stageEntry } from '../../src/registry/stages.js';
import { readState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

describe('predictFiles', () => {
  it('extracts backticked paths and Files: lines, deduplicated and sorted', () => {
    const plan = [
      '# Plan', '', '## Steps', '',
      '1. Edit `src/auth/session.ts` and add a test in `test/auth/session.test.ts`.',
      '2. Files: src/auth/index.ts, src/app.ts',
      '3. Touch `src/auth/session.ts` again; do not touch `README` (no extension, ignored) or `npm test`.',
      'Files:  docs/auth.md',
    ].join('\n');
    expect(predictFiles(plan)).toEqual(['docs/auth.md', 'src/app.ts', 'src/auth/index.ts', 'src/auth/session.ts', 'test/auth/session.test.ts']);
    expect(predictFiles('')).toEqual([]);
  });
});

describe('cluster', () => {
  it('groups units whose predicted files overlap at Jaccard >= 0.2 and keeps the rest apart', () => {
    const units = [
      { id: 'A-1', files: ['src/auth/session.ts', 'src/auth/index.ts', 'test/auth.test.ts'] },
      { id: 'A-2', files: ['src/auth/session.ts', 'src/auth/cookies.ts'] },
      { id: 'B-1', files: ['src/billing/invoice.ts', 'test/billing.test.ts'] },
    ];
    expect(jaccard(units[0]!.files, units[1]!.files)).toBeCloseTo(0.25);
    expect(jaccard(units[0]!.files, units[2]!.files)).toBe(0);
    expect(cluster(units)).toEqual([['A-1', 'A-2'], ['B-1']]);
  });

  it('is transitive through union-find and stable in input order', () => {
    const units = [
      { id: 'X', files: ['a', 'b', 'c'] },
      { id: 'Y', files: ['c', 'd', 'e'] },
      { id: 'Z', files: ['e', 'f', 'g'] },
      { id: 'W', files: [] },
    ];
    expect(cluster(units)).toEqual([['X', 'Y', 'Z'], ['W']]);
    expect(cluster([])).toEqual([]);
  });
});

describe('unit link', () => {
  it('records batch siblings symmetrically', async () => {
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    for (const id of ['CV-1', 'CV-2', 'CV-3']) await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id }, ctx);
    const r = await dispatch(unitTool, { action: 'link', id: 'CV-1', related: ['CV-2', 'CV-3'] }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(readState(unitDirFor(ctx, 'CV-1')).siblings).toEqual(['CV-2', 'CV-3']);
    expect(readState(unitDirFor(ctx, 'CV-2')).siblings).toEqual(['CV-1', 'CV-3']);
    expect(readState(unitDirFor(ctx, 'CV-3')).siblings).toEqual(['CV-1', 'CV-2']);
    const again = await dispatch(unitTool, { action: 'link', id: 'CV-2', related: ['CV-3'] }, ctx);
    expect(again.envelope.ok).toBe(true);
    expect(readState(unitDirFor(ctx, 'CV-2')).siblings).toEqual(['CV-1', 'CV-3']);
    const missing = await dispatch(unitTool, { action: 'link', id: 'CV-1', related: ['CV-9'] }, ctx);
    expect(missing.envelope.ok).toBe(false);
  });
});

describe('batch brief', () => {
  it('takes no id and lays out define+plan per id, clustering, the approval checkpoint, sequential pilots and linking', async () => {
    expect(stageEntry('batch')).toMatchObject({ standalone: true, takesNoId: true });
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    const r = await dispatch(unitTool, { action: 'brief', stage: 'batch', quiet: true }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('# batch');
    expect(r.text).toMatch(/define only/i);
    expect(r.text).toContain('Files:');
    expect(r.text).toMatch(/cluster/i);
    expect(r.text).toMatch(/approv/i);
    expect(r.text).toMatch(/checkpoint/i);
    expect(r.text).toMatch(/sequential/i);
    expect(r.text).toContain('unit link');
    expect(r.text).toMatch(/jaccard|0\.2/i);
  });
});
