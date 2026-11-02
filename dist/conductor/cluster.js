/** File paths a plan intends to touch: backticked paths and `Files:` lines. */
export function predictFiles(plan) {
    const out = new Set();
    const isPath = (s) => /^[\w@./-]+\.[a-z0-9]+$/i.test(s) && !s.startsWith('.') && !/\s/.test(s);
    for (const m of plan.matchAll(/`([^`\n]+)`/g)) {
        const candidate = m[1].trim();
        if (isPath(candidate))
            out.add(candidate);
    }
    for (const line of plan.split(/\r?\n/)) {
        const m = /^\s*(?:[-*]|\d+\.)?\s*Files?:\s*(.+)$/i.exec(line);
        if (!m)
            continue;
        for (const part of m[1].split(/[,\s]+/)) {
            const candidate = part.replace(/^`|`$/g, '').trim();
            if (isPath(candidate))
                out.add(candidate);
        }
    }
    return [...out].sort();
}
/** |A ∩ B| / |A ∪ B|; 0 when both are empty. */
export function jaccard(a, b) {
    const A = new Set(a);
    const B = new Set(b);
    const union = new Set([...A, ...B]);
    if (!union.size)
        return 0;
    let inter = 0;
    for (const x of A)
        if (B.has(x))
            inter += 1;
    return inter / union.size;
}
export const OVERLAP_THRESHOLD = 0.2;
/** Union-find grouping of units whose predicted files overlap at or above the threshold; groups keep input order. */
export function cluster(units, threshold = OVERLAP_THRESHOLD) {
    const parent = units.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const unite = (a, b) => { parent[find(a)] = find(b); };
    for (let i = 0; i < units.length; i++) {
        for (let j = i + 1; j < units.length; j++) {
            if (jaccard(units[i].files, units[j].files) >= threshold)
                unite(i, j);
        }
    }
    const groups = new Map();
    units.forEach((u, i) => {
        const root = find(i);
        groups.set(root, [...(groups.get(root) ?? []), u.id]);
    });
    return [...groups.values()];
}
