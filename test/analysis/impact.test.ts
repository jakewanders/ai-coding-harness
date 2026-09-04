import { describe, expect, it } from 'vitest';
import { parseDiff } from '../../src/analysis/diff-parse.js';
import { changedExports, impactRadius } from '../../src/analysis/impact.js';
import { makeRepo } from '../helpers/git.js';
import { NEW_EXPORT_DIFF, PII_DIFF } from './fixtures.js';

describe('impactRadius', () => {
  it('finds the new export and the one file importing it, ignoring untracked/ignored files', () => {
    const worktree = makeRepo({
      'src/util/format.ts': 'export function formatMoney(cents: number): string { return String(cents); }\n',
      'src/cart.ts': "import { formatMoney } from './util/format.js';\nexport const total = formatMoney(1);\n",
      'src/other.ts': "import { unrelated } from './x.js';\n",
      'scripts/ignored.ts': "import { formatMoney } from '../src/util/format.js';\n",
      '.gitignore': 'scripts/\n',
    });
    const r = impactRadius(parseDiff(NEW_EXPORT_DIFF), worktree);
    expect(r.changed_exports).toEqual([{ file: 'src/util/format.ts', name: 'formatMoney' }]);
    expect(r.consumers).toEqual([{ file: 'src/cart.ts', imports: ['formatMoney'] }]);
  });

  it('reports no exports and no consumers for an internal-only diff', () => {
    const worktree = makeRepo({ 'src/auth.ts': 'export async function login() {}\n' });
    const r = impactRadius(parseDiff(PII_DIFF), worktree);
    expect(r.changed_exports).toEqual([]);
    expect(r.consumers).toEqual([]);
  });

  it('recognizes several export forms', () => {
    const lines = ['export const a = 1;', 'export default class Widget {}', 'export { b, c as d };', 'module.exports.legacy = fn;', 'export type Shape = {};', 'def compute(x):', 'func Serve(w) {'];
    expect(changedExports('f', lines.map((text, i) => ({ line: i + 1, text }))).map((e) => e.name)).toEqual(['a', 'Widget', 'b', 'd', 'legacy', 'Shape', 'compute', 'Serve']);
  });
});
