export type LedgerKind = 'ask' | 'landing';
export type LedgerStatus = 'open' | 'rechecked' | 'closed';
export interface LedgerEntry {
    id: string;
    repo: string;
    kind: LedgerKind;
    text: string;
    origin_unit: string | null;
    created_at: string;
    status: LedgerStatus;
    last_checked_unit?: string;
    notes?: string[];
    closed_reason?: string;
}
export interface Ledger {
    schema: 1;
    entries: LedgerEntry[];
}
export declare function ledgerPath(vault: string, repo: string): string;
export declare function readLedger(vault: string, repo: string): Ledger;
export declare function writeLedger(vault: string, repo: string, ledger: Ledger): void;
/** Next sequential id `L-<n>` for the repo ledger. */
export declare function nextLedgerId(ledger: Ledger): string;
/** Entries that still carry forward (not closed). */
export declare function openEntries(ledger: Ledger): LedgerEntry[];
