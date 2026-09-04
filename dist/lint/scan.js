import fs from 'node:fs';
import path from 'node:path';
/** Directories whose contents are never part of the shipped vocabulary scan. */
const SHIPPED_DIRS = ['src', 'skills', 'hooks', 'examples'];
const SHIPPED_FILES = ['README.md'];
const EXCLUDED_DIRS = new Set(['dist', 'node_modules', 'docs', 'test']);
/**
 * Scan each file line by line against the deny patterns. A line that contains
 * `allowMarker` is skipped entirely. Each pattern reports at most one hit per
 * line; hits are ordered by file, line, then pattern order.
 */
export function scanFiles(files, deny, allowMarker) {
    const hits = [];
    for (const file of files) {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((text, i) => {
            if (text.includes(allowMarker))
                return;
            for (const pattern of deny) {
                const re = new RegExp(pattern.source, pattern.flags.replace('g', ''));
                const m = re.exec(text);
                if (m)
                    hits.push({ file, line: i + 1, term: m[0] });
            }
        });
    }
    return hits;
}
function walk(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name))
                continue;
            walk(path.join(dir, entry.name), out);
        }
        else if (entry.isFile()) {
            out.push(path.join(dir, entry.name));
        }
    }
}
/**
 * Every shipped file under `root`: src/, skills/, hooks/, examples/, plus
 * README.md. Excludes dist/, node_modules/, docs/, test/ at any depth.
 * Missing directories are ignored.
 */
export function collectShipped(root) {
    const out = [];
    for (const dir of SHIPPED_DIRS) {
        const abs = path.join(root, dir);
        if (fs.existsSync(abs) && fs.statSync(abs).isDirectory())
            walk(abs, out);
    }
    for (const file of SHIPPED_FILES) {
        const abs = path.join(root, file);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile())
            out.push(abs);
    }
    return out.sort();
}
