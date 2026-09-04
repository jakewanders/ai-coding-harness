/**
 * Merge review columns into one verdict: any blocker or any missing required
 * column → not_ready; any major → needs_attention; otherwise ship.
 */
export function synthesize(columns, required) {
    const counts = { blocker: 0, major: 0, minor: 0, note: 0 };
    for (const c of columns)
        for (const f of c.findings)
            counts[f.severity] += 1;
    const present = new Set(columns.map((c) => c.column));
    const missing_columns = required.filter((r) => !present.has(r));
    const verdict = counts.blocker > 0 || missing_columns.length > 0 ? 'not_ready' : counts.major > 0 ? 'needs_attention' : 'ship';
    return { verdict, counts, missing_columns };
}
/** Latest record per column among the given records (later wins). */
export function latestPerColumn(records) {
    const byColumn = new Map();
    for (const r of records)
        byColumn.set(r.column, r);
    return [...byColumn.values()];
}
