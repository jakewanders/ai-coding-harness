import type { Criterion } from '../spec/requirement.js';
import { tokenize } from '../store/index.js';
import type { Hunkfile } from './diff-parse.js';

export interface CriterionMatch {
  criterion: Criterion;
  files: string[];
  terms: string[];
}

export interface CriteriaMap {
  matched: CriterionMatch[];
  unproven: Criterion[];
  orphan_hunks: Hunkfile[];
}

const GENERIC = new Set(['the', 'user', 'users', 'when', 'then', 'should', 'must', 'can', 'are', 'is', 'with', 'new', 'all', 'any', 'each', 'via']);

/** Tokens of a file: path words plus added/removed text, with common code noise dropped. */
function hunkTokens(h: Hunkfile): Set<string> {
  const text = [h.path.replace(/[\/._-]/g, ' '), ...h.added.map((l) => l.text), ...h.removed.map((l) => l.text)].join(' ');
  return new Set(tokenize(text.replace(/([a-z])([A-Z])/g, '$1 $2')));
}

function stem(t: string): string {
  return t.replace(/(ies|es|s|ed|ing)$/, '').replace(/^(format)t?/, 'format');
}

/** Keyword overlap between criterion text and hunk text or path, both directions. */
export function criteriaMap(criteria: Criterion[], diff: Hunkfile[]): CriteriaMap {
  const hunks = diff.map((h) => ({ h, tokens: new Set([...hunkTokens(h)].map(stem)) }));
  const matched: CriterionMatch[] = [];
  const unproven: Criterion[] = [];
  const usedHunks = new Set<string>();
  for (const c of criteria) {
    const terms = tokenize(c.text).filter((t) => !GENERIC.has(t) && t.length > 2).map(stem);
    const files: string[] = [];
    const hit: string[] = [];
    for (const { h, tokens } of hunks) {
      const overlap = terms.filter((t) => tokens.has(t));
      if (overlap.length) { files.push(h.path); hit.push(...overlap); usedHunks.add(h.path); }
    }
    if (files.length) matched.push({ criterion: c, files, terms: [...new Set(hit)] });
    else unproven.push(c);
  }
  return { matched, unproven, orphan_hunks: diff.filter((h) => !usedHunks.has(h.path)) };
}
