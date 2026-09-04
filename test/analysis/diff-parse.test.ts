import { describe, expect, it } from 'vitest';
import { parseDiff } from '../../src/analysis/diff-parse.js';
import { MIXED_DIFF, NEW_EXPORT_DIFF, PII_DIFF } from './fixtures.js';

describe('parseDiff', () => {
  it('parses a new file with numbered added lines', () => {
    const files = parseDiff(NEW_EXPORT_DIFF);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: 'src/util/format.ts', isNew: true, removed: [] });
    expect(files[0]!.added.map((l) => l.line)).toEqual([1, 2, 3]);
    expect(files[0]!.added[0]!.text).toBe('export function formatMoney(cents: number): string {');
  });

  it('numbers added lines from the hunk header and keeps context out', () => {
    const [f] = parseDiff(PII_DIFF);
    expect(f).toMatchObject({ path: 'src/auth.ts', isNew: false });
    expect(f!.added.map((l) => [l.line, l.text.trim()])).toEqual([[11, 'console.log(user.email);'], [12, "analytics.track('login', { phone: user.phone });"], [13, 'const safe = user.id;']]);
  });

  it('handles multiple files, removals and deletions', () => {
    const files = parseDiff(MIXED_DIFF);
    expect(files.map((f) => f.path)).toEqual(['src/a.ts', 'src/removed.ts']);
    expect(files[0]!.removed).toEqual([{ line: 2, text: 'const b = 2;' }]);
    expect(files[0]!.added.map((l) => l.line)).toEqual([2, 3]);
    expect(files[1]!.removed).toEqual([{ line: 1, text: 'export const gone = true;' }]);
    expect(files[1]!.isNew).toBe(false);
    expect(parseDiff('')).toEqual([]);
  });
});
