import fs from 'node:fs';
import path from 'node:path';
export const INDEX_SCHEMA = 1;
const STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
    'or', 'that', 'the', 'to', 'was', 'were', 'will', 'with', 'we', 'this', 'these', 'those', 'not', 'but', 'so',
]);
/** Lowercase alphanumeric tokens, stopwords and one-character tokens dropped, order-preserving unique. */
export function tokenize(text) {
    const out = [];
    for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
        if (raw.length < 2 || STOPWORDS.has(raw) || out.includes(raw))
            continue;
        out.push(raw);
    }
    return out;
}
export function indexPath(vault) {
    return path.join(vault, 'index', 'digests.json');
}
export function readIndex(vault) {
    const file = indexPath(vault);
    if (!fs.existsSync(file))
        return { schema: INDEX_SCHEMA, entries: [] };
    try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { schema: INDEX_SCHEMA, entries: Array.isArray(raw.entries) ? raw.entries : [] };
    }
    catch {
        return { schema: INDEX_SCHEMA, entries: [] };
    }
}
export function writeIndex(vault, index) {
    const file = indexPath(vault);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(index, null, 2) + '\n');
}
export function entryFor(id, repo, digest, updatedAt) {
    return {
        id, repo, summary: digest.summary, decisions: digest.decisions, tags: digest.tags,
        tokens: tokenize([digest.summary, ...digest.decisions, ...digest.tags, id].join(' ')),
        updated_at: updatedAt,
    };
}
/** Insert or replace the entry for (repo, id). */
export function upsertEntry(vault, entry) {
    const index = readIndex(vault);
    const entries = index.entries.filter((e) => !(e.id === entry.id && e.repo === entry.repo));
    entries.push(entry);
    entries.sort((a, b) => a.repo.localeCompare(b.repo) || a.id.localeCompare(b.id));
    const next = { schema: INDEX_SCHEMA, entries };
    writeIndex(vault, next);
    return next;
}
/** Term-overlap score: one point per query token found, two when it is a tag. */
export function searchIndex(index, query, opts = {}) {
    const terms = tokenize(query);
    if (!terms.length)
        return [];
    const hits = [];
    for (const e of index.entries) {
        if (opts.repo && e.repo !== opts.repo)
            continue;
        const tags = new Set(e.tags.map((t) => t.toLowerCase()));
        const matched = terms.filter((t) => e.tokens.includes(t) || tags.has(t));
        if (!matched.length)
            continue;
        const score = matched.reduce((n, t) => n + (tags.has(t) ? 2 : 1), 0);
        hits.push({ ...e, score, matched });
    }
    hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return hits.slice(0, opts.limit ?? 10);
}
// ---- digest.md -------------------------------------------------------------------
export function renderDigest(id, digest) {
    const lines = [`# Digest: ${id}`, '', digest.summary.trim(), '', '## Decisions', ''];
    lines.push(...(digest.decisions.length ? digest.decisions.map((d) => `- ${d}`) : ['- none recorded']));
    lines.push('', '## Tags', '', digest.tags.length ? digest.tags.join(', ') : 'none', '');
    return lines.join('\n');
}
export function parseDigest(md) {
    const lines = md.split(/\r?\n/);
    const decisionsAt = lines.findIndex((l) => l.trim() === '## Decisions');
    const tagsAt = lines.findIndex((l) => l.trim() === '## Tags');
    const bodyStart = lines[0]?.startsWith('# ') ? 1 : 0;
    const summary = lines.slice(bodyStart, decisionsAt >= 0 ? decisionsAt : undefined).join('\n').trim();
    const decisions = decisionsAt >= 0
        ? lines.slice(decisionsAt + 1, tagsAt >= 0 ? tagsAt : undefined).map((l) => /^\s*-\s+(.+)$/.exec(l)?.[1]?.trim()).filter((d) => Boolean(d) && d !== 'none recorded')
        : [];
    const tagLine = tagsAt >= 0 ? lines.slice(tagsAt + 1).map((l) => l.trim()).find((l) => l.length > 0) ?? '' : '';
    const tags = tagLine && tagLine !== 'none' ? tagLine.split(',').map((t) => t.trim()).filter(Boolean) : [];
    return { summary, decisions, tags };
}
/** Every `<repo>/units/<id>/digest.md` under the vault, with repo and id. */
export function findDigestFiles(vault) {
    const out = [];
    const walk = (dir, segments) => {
        if (!fs.existsSync(dir))
            return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name === '.git' || entry.name === 'index')
                continue;
            const abs = path.join(dir, entry.name);
            if (entry.name === 'units') {
                for (const unit of fs.readdirSync(abs, { withFileTypes: true })) {
                    const file = path.join(abs, unit.name, 'digest.md');
                    if (unit.isDirectory() && fs.existsSync(file))
                        out.push({ repo: segments.join('/'), id: unit.name, file });
                }
            }
            else {
                walk(abs, [...segments, entry.name]);
            }
        }
    };
    walk(vault, []);
    return out;
}
/** Rebuild the index from every digest.md in the vault. */
export function rebuildIndex(vault, now = () => new Date()) {
    const entries = findDigestFiles(vault).map(({ repo, id, file }) => entryFor(id, repo, parseDigest(fs.readFileSync(file, 'utf8')), fs.statSync(file).mtime.toISOString() || now().toISOString()));
    entries.sort((a, b) => a.repo.localeCompare(b.repo) || a.id.localeCompare(b.id));
    const index = { schema: INDEX_SCHEMA, entries };
    writeIndex(vault, index);
    return index;
}
