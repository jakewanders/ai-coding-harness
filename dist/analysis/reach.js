import path from 'node:path';
import { listFiles, matchGlobs, readText } from './files.js';
import { changedExports } from './impact.js';
export const DEFAULT_SUBJECTS = {
    e2e_globs: ['**/e2e/**', '**/*.e2e.*', '**/*.spec.*', '**/tests/e2e/**'],
    mock_globs: ['**/mocks/**', '**/__mocks__/**', '**/*.mock.*', '**/handlers/**', '**/fixtures/**'],
    contract_globs: ['**/contracts/**', '**/*.contract.*', '**/openapi*', '**/*.schema.*', '**/schema/**'],
};
const ROUTE_PATTERNS = [
    /\b(?:app|router|server|api|\w+Router)\.(?:get|post|put|delete|patch|options|head|all)\(\s*['"`]([^'"`]+)['"`]/,
    /@(?:Route|Get|Post|Put|Delete|Patch|Controller)\(\s*['"`]([^'"`]+)['"`]/,
    /\bpath:\s*['"`]([^'"`]+)['"`]/,
    /\b(?:Route|route)\(\s*['"`]([^'"`]+)['"`]/,
];
/** New files, exports and routes introduced by the diff. */
export function surfacesOf(diff) {
    const out = [];
    const push = (surface, kind) => { if (!out.some((s) => s.surface === surface))
        out.push({ surface, kind }); };
    for (const file of diff) {
        if (file.isNew)
            push(file.path, 'file');
        for (const e of changedExports(file.path, file.added))
            push(e.name, 'export');
        for (const { text } of file.added) {
            for (const re of ROUTE_PATTERNS) {
                const m = re.exec(text);
                if (m && m[1].startsWith('/'))
                    push(m[1], 'route');
            }
        }
    }
    return out;
}
function mentions(text, surface, name) {
    if (surface === 'file') {
        const stem = path.basename(name).replace(/\.[^.]+$/, '');
        return text.includes(name) || new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
    }
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`${escaped}(?![\\w/-])`).test(text);
}
/** For each new surface, the subject files (e2e, mock, contract) that mention it. */
export function reachAudit(diff, subjects, worktree) {
    const files = listFiles(worktree);
    const groups = [
        ['e2e', matchGlobs(files, subjects.e2e_globs)],
        ['mock', matchGlobs(files, subjects.mock_globs)],
        ['contract', matchGlobs(files, subjects.contract_globs)],
    ];
    const texts = new Map();
    const textOf = (rel) => {
        if (!texts.has(rel))
            texts.set(rel, readText(worktree, rel) ?? '');
        return texts.get(rel);
    };
    return surfacesOf(diff).map(({ surface, kind }) => {
        const covered_by = [];
        const covered_kinds = [];
        for (const [subjectKind, list] of groups) {
            for (const rel of list) {
                if (covered_by.includes(rel) || rel === surface)
                    continue;
                if (mentions(textOf(rel), kind, surface)) {
                    covered_by.push(rel);
                    covered_kinds.push(subjectKind);
                }
            }
        }
        return { surface, kind, covered_by, covered_kinds };
    });
}
