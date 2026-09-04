import { describe, expect, it } from 'vitest';
import { criteriaMap } from '../../src/analysis/criteria-map.js';
import { parseDiff } from '../../src/analysis/diff-parse.js';
import { NEW_EXPORT_DIFF, PII_DIFF } from './fixtures.js';

describe('criteriaMap', () => {
  it('finds criteria with no matching hunk and hunks with no matching criterion', () => {
    const criteria = [
      { id: 'AC-1', text: 'Money amounts are formatted with two decimals' },
      { id: 'AC-2', text: 'Users receive a welcome notification' },
    ];
    const diff = parseDiff(NEW_EXPORT_DIFF + PII_DIFF);
    const map = criteriaMap(criteria, diff);
    expect(map.unproven.map((c) => c.id)).toEqual(['AC-2']);
    expect(map.matched.map((m) => [m.criterion.id, m.files])).toEqual([['AC-1', ['src/util/format.ts']]]);
    expect(map.orphan_hunks.map((h) => h.path)).toEqual(['src/auth.ts']);
  });

  it('matches on file path words too', () => {
    const map = criteriaMap([{ id: 'AC-1', text: 'Fix the auth session start' }], parseDiff(PII_DIFF));
    expect(map.unproven).toEqual([]);
    expect(map.orphan_hunks).toEqual([]);
  });
});
