export const CRITERIA_HEADING = '## Acceptance criteria';
const SOURCE_PREFIX = 'Source: ';
/** Number criteria texts as AC-1… */
export function numberCriteria(texts) {
    return texts.map((text, i) => ({ id: `AC-${i + 1}`, text: text.trim() }));
}
/** requirement.md: title, optional source line, body, then the criteria section. */
export function renderRequirement(req) {
    const lines = [`# ${req.title}`, ''];
    if (req.url)
        lines.push(`${SOURCE_PREFIX}${req.url}`, '');
    if (req.body.trim())
        lines.push(req.body.trim(), '');
    if (req.criteria.length) {
        lines.push(CRITERIA_HEADING, '');
        for (const c of req.criteria)
            lines.push(`- ${c.id}: ${c.text}`);
        lines.push('');
    }
    return lines.join('\n');
}
export function parseRequirement(md) {
    const lines = md.split(/\r?\n/);
    let title = '';
    let url = null;
    let i = 0;
    if (lines[0]?.startsWith('# ')) {
        title = lines[0].slice(2).trim();
        i = 1;
    }
    while (i < lines.length && lines[i].trim() === '')
        i++;
    if (lines[i]?.startsWith(SOURCE_PREFIX)) {
        url = lines[i].slice(SOURCE_PREFIX.length).trim() || null;
        i++;
    }
    const rest = lines.slice(i);
    const headingAt = rest.findIndex((l) => l.trim() === CRITERIA_HEADING);
    const bodyLines = headingAt >= 0 ? rest.slice(0, headingAt) : rest;
    const criteriaLines = headingAt >= 0 ? rest.slice(headingAt + 1) : [];
    const criteria = [];
    for (const line of criteriaLines) {
        const m = /^-\s*(AC-\d+):\s*(.*)$/.exec(line.trim());
        if (m)
            criteria.push({ id: m[1], text: m[2].trim() });
    }
    return { title, url, body: bodyLines.join('\n').trim(), criteria };
}
const RELATED_KINDS = ['parent', 'sibling', 'linked', 'pr'];
/** related.md: one bullet per item, `- <kind>: <ref> — <title> (<note>)`. */
export function renderRelated(items) {
    const lines = ['# Related', ''];
    for (const it of items) {
        let line = `- ${it.kind}: ${it.ref}`;
        if (it.title)
            line += ` — ${it.title}`;
        if (it.note)
            line += ` (${it.note})`;
        lines.push(line);
    }
    lines.push('');
    return lines.join('\n');
}
export function parseRelated(md) {
    const out = [];
    for (const raw of md.split(/\r?\n/)) {
        const m = /^-\s*(parent|sibling|linked|pr):\s*(.+)$/.exec(raw.trim());
        if (!m)
            continue;
        const kind = m[1];
        let rest = m[2].trim();
        let note = null;
        const noteMatch = /\s\(([^()]*)\)$/.exec(rest);
        if (noteMatch) {
            note = noteMatch[1];
            rest = rest.slice(0, noteMatch.index).trim();
        }
        let title = null;
        const dash = rest.indexOf(' — ');
        let ref = rest;
        if (dash >= 0) {
            ref = rest.slice(0, dash).trim();
            title = rest.slice(dash + 3).trim() || null;
        }
        out.push({ kind, ref, title, note });
    }
    return out;
}
