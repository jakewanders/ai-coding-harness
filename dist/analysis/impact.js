import path from 'node:path';
import { listFiles, readText } from './files.js';
const EXPORT_PATTERNS = [
    /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum|abstract\s+class)\s+([A-Za-z_$][\w$]*)/,
    /^\s*module\.exports\.([A-Za-z_$][\w$]*)\s*=/,
    /^\s*def\s+([A-Za-z_]\w*)\s*\(/,
    /^\s*func\s+(?:\([^)]*\)\s*)?([A-Z]\w*)\s*\(/,
    /^\s*pub\s+(?:async\s+)?fn\s+([a-z_]\w*)/,
];
/** Exported names declared on added lines. */
export function changedExports(file, added) {
    const out = [];
    const push = (name) => { if (!out.some((e) => e.name === name))
        out.push({ file, name }); };
    for (const { text } of added) {
        for (const re of EXPORT_PATTERNS) {
            const m = re.exec(text);
            if (m) {
                push(m[1]);
                break;
            }
        }
        const list = /^\s*export\s*\{([^}]*)\}/.exec(text);
        if (list) {
            for (const part of list[1].split(',')) {
                const m = /^\s*(\w+)(?:\s+as\s+(\w+))?\s*$/.exec(part);
                if (m)
                    push(m[2] ?? m[1]);
            }
        }
    }
    return out;
}
function moduleStems(file) {
    const base = path.basename(file).replace(/\.[^.]+$/, '');
    const noExt = file.replace(/\.[^.]+$/, '');
    return base === 'index' ? [noExt, path.dirname(file)] : [noExt, base];
}
/** Does this line import from `file`? Matches path-like references to the module stem. */
function referencesModule(line, file) {
    if (!/\b(import|require|from|use|include)\b/.test(line))
        return false;
    const specs = [...line.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    const stems = moduleStems(file);
    return specs.some((spec) => {
        const clean = spec.replace(/\.(js|ts|mjs|cjs|jsx|tsx|py|go|rs)$/, '').replace(/^\.\/|^\.\.\//g, '');
        return stems.some((stem) => clean === stem || clean.endsWith(`/${stem}`) || clean.endsWith(`/${path.basename(stem)}`));
    });
}
/** Changed exports and the files that import them, across the tracked worktree. */
export function impactRadius(diff, worktree) {
    const changed = diff.flatMap((f) => changedExports(f.path, f.added));
    if (!changed.length)
        return { changed_exports: [], consumers: [] };
    const byFile = new Map();
    for (const e of changed)
        byFile.set(e.file, [...(byFile.get(e.file) ?? []), e.name]);
    const consumers = [];
    for (const rel of listFiles(worktree)) {
        if (byFile.has(rel))
            continue;
        const text = readText(worktree, rel);
        if (!text)
            continue;
        const imports = new Set();
        for (const line of text.split('\n')) {
            for (const [file, names] of byFile) {
                if (!referencesModule(line, file))
                    continue;
                const named = names.filter((n) => new RegExp(`\\b${n}\\b`).test(line));
                if (named.length)
                    named.forEach((n) => imports.add(n));
                else
                    imports.add('*');
            }
        }
        if (imports.size)
            consumers.push({ file: rel, imports: [...imports].sort() });
    }
    return { changed_exports: changed, consumers };
}
