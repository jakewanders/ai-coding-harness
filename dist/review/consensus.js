export const SCREEN_SLOTS = [
    ['technical', 'primary'], ['technical', 'second'], ['product', 'primary'], ['product', 'second'],
];
/**
 * Computed consensus over the four structured calls (latest record per slot):
 * unanimous → that verdict; any `invalid` alongside a `valid`, or any `unclear`
 * → unclear. Missing slots are listed as dissent and count against agreement.
 */
export function consensus(records) {
    const latest = new Map();
    for (const r of records)
        latest.set(`${r.dimension}/${r.model}`, r);
    const present = SCREEN_SLOTS.map(([d, m]) => latest.get(`${d}/${m}`)).filter((r) => Boolean(r));
    const calls = new Set(present.map((r) => r.verdict));
    let verdict;
    if (!present.length)
        verdict = 'unclear';
    else if (calls.size === 1)
        verdict = present[0].verdict;
    else
        verdict = 'unclear';
    const dissent = [];
    let agreeing = 0;
    for (const [d, m] of SCREEN_SLOTS) {
        const r = latest.get(`${d}/${m}`);
        if (!r) {
            dissent.push(`${d}/${m}: missing`);
            continue;
        }
        const agrees = calls.size === 1 || r.verdict === (verdict === 'unclear' ? majority(present) : verdict);
        if (agrees)
            agreeing += 1;
        else
            dissent.push(`${d}/${m}: ${r.verdict}${r.reasons.length ? ` — ${r.reasons.join('; ')}` : ''}`);
    }
    return { verdict, agreement: present.length ? agreeing / present.length : 0, dissent };
}
function majority(records) {
    const counts = new Map();
    for (const r of records)
        counts.set(r.verdict, (counts.get(r.verdict) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
