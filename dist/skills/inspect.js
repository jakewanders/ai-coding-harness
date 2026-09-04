import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
/** YAML frontmatter between leading `---` fences; scalars only. */
export function parseFrontmatter(text) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
    if (!m)
        return { data: {}, body: text };
    let raw;
    try {
        raw = parseYaml(m[1]);
    }
    catch {
        raw = {};
    }
    const data = {};
    if (typeof raw === 'object' && raw !== null) {
        for (const [k, v] of Object.entries(raw)) {
            if (v !== null && v !== undefined && typeof v !== 'object')
                data[k] = String(v);
        }
    }
    return { data, body: m[2] ?? '' };
}
/** Every `@root/<path>` reference, without the prefix, in first-seen order. */
export function extractRootRefs(text) {
    const out = [];
    for (const m of text.matchAll(/@root\/([A-Za-z0-9_./-]+)/g)) {
        const ref = m[1].replace(/[.]+$/, '');
        if (!out.includes(ref))
            out.push(ref);
    }
    return out;
}
/** `tool action {...}` lines inside fenced ```harness blocks, in order. */
export function extractToolCalls(text) {
    const out = [];
    for (const block of text.matchAll(/```harness[^\n]*\n([\s\S]*?)```/g)) {
        for (const line of block[1].split('\n')) {
            const m = /^\s*([a-z][a-z0-9_]*)\s+([a-z][a-z0-9_]*)\b/.exec(line);
            if (m)
                out.push({ tool: m[1], action: m[2] });
        }
    }
    return out;
}
/** Every skills/<name>/SKILL.md under root (the _shared directory is prose, not a skill). */
export function listSkills(root) {
    const dir = path.join(root, 'skills');
    if (!fs.existsSync(dir))
        return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('_') && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))
        .map((e) => {
        const file = path.join(dir, e.name, 'SKILL.md');
        const text = fs.readFileSync(file, 'utf8');
        const fm = parseFrontmatter(text);
        return { name: e.name, file, text, frontmatter: fm.data, body: fm.body };
    })
        .sort((a, b) => a.name.localeCompare(b.name));
}
