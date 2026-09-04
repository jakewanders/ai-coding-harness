import fs from 'node:fs';
import path from 'node:path';
export function ledgerPath(vault, repo) {
    return path.join(vault, repo, 'ledger.json');
}
export function readLedger(vault, repo) {
    const file = ledgerPath(vault, repo);
    if (!fs.existsSync(file))
        return { schema: 1, entries: [] };
    try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { schema: 1, entries: Array.isArray(raw.entries) ? raw.entries : [] };
    }
    catch {
        return { schema: 1, entries: [] };
    }
}
export function writeLedger(vault, repo, ledger) {
    const file = ledgerPath(vault, repo);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
}
/** Next sequential id `L-<n>` for the repo ledger. */
export function nextLedgerId(ledger) {
    const max = ledger.entries.reduce((m, e) => Math.max(m, Number(/^L-(\d+)$/.exec(e.id)?.[1] ?? 0)), 0);
    return `L-${max + 1}`;
}
/** Entries that still carry forward (not closed). */
export function openEntries(ledger) {
    return ledger.entries.filter((e) => e.status !== 'closed');
}
