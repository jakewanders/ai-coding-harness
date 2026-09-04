import { tokenize } from '../store/index.js';
const GENERIC = new Set(['the', 'user', 'users', 'when', 'then', 'should', 'must', 'can', 'are', 'is', 'with', 'new', 'all', 'any', 'each', 'via']);
/** Tokens of a file: path words plus added/removed text, with common code noise dropped. */
function hunkTokens(h) {
    const text = [h.path.replace(/[\/._-]/g, ' '), ...h.added.map((l) => l.text), ...h.removed.map((l) => l.text)].join(' ');
    return new Set(tokenize(text.replace(/([a-z])([A-Z])/g, '$1 $2')));
}
function stem(t) {
    return t.replace(/(ies|es|s|ed|ing)$/, '').replace(/^(format)t?/, 'format');
}
/** Keyword overlap between criterion text and hunk text or path, both directions. */
export function criteriaMap(criteria, diff) {
    const hunks = diff.map((h) => ({ h, tokens: new Set([...hunkTokens(h)].map(stem)) }));
    const matched = [];
    const unproven = [];
    const usedHunks = new Set();
    for (const c of criteria) {
        const terms = tokenize(c.text).filter((t) => !GENERIC.has(t) && t.length > 2).map(stem);
        const files = [];
        const hit = [];
        for (const { h, tokens } of hunks) {
            const overlap = terms.filter((t) => tokens.has(t));
            if (overlap.length) {
                files.push(h.path);
                hit.push(...overlap);
                usedHunks.add(h.path);
            }
        }
        if (files.length)
            matched.push({ criterion: c, files, terms: [...new Set(hit)] });
        else
            unproven.push(c);
    }
    return { matched, unproven, orphan_hunks: diff.filter((h) => !usedHunks.has(h.path)) };
}
