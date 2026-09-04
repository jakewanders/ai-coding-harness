import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_ORDER } from '../../src/registry/stages.js';
import { measureTokens } from '../../src/system/tokens.js';
import { makeCtx, repoRoot } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

const STAGE_CAP = 6000;

describe('docs/token-budget.md', () => {
  const doc = fs.readFileSync(path.join(repoRoot, 'docs', 'token-budget.md'), 'utf8');
  const live = measureTokens(makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) }), 'thorough');

  it('records a total within 10% of a live thorough measurement', () => {
    const m = /^\|\s*total\s*\|[^\n]*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*$/im.exec(doc);
    expect(m, 'total row with bytes and tokens').not.toBeNull();
    const recorded = Number(m![2]);
    expect(Math.abs(recorded - live.total.tokens) / live.total.tokens).toBeLessThanOrEqual(0.1);
  });

  it('lists every core stage in the after table', () => {
    const after = doc.slice(doc.search(/^##+ .*after/im));
    for (const stage of CORE_ORDER) expect(after, stage).toMatch(new RegExp(`^\\|\\s*${stage}\\s*\\|`, 'm'));
  });

  it('keeps every stage brief plus skill under the cap', () => {
    for (const row of live.rows) expect(row.tokens, `${row.stage} = ${row.tokens} tokens`).toBeLessThan(STAGE_CAP);
  });
});
