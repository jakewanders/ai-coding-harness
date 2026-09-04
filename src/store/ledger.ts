import fs from 'node:fs';
import path from 'node:path';

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

export function ledgerPath(vault: string, repo: string): string {
  return path.join(vault, repo, 'ledger.json');
}

export function readLedger(vault: string, repo: string): Ledger {
  const file = ledgerPath(vault, repo);
  if (!fs.existsSync(file)) return { schema: 1, entries: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Ledger>;
    return { schema: 1, entries: Array.isArray(raw.entries) ? raw.entries : [] };
  } catch {
    return { schema: 1, entries: [] };
  }
}

export function writeLedger(vault: string, repo: string, ledger: Ledger): void {
  const file = ledgerPath(vault, repo);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
}

/** Next sequential id `L-<n>` for the repo ledger. */
export function nextLedgerId(ledger: Ledger): string {
  const max = ledger.entries.reduce((m, e) => Math.max(m, Number(/^L-(\d+)$/.exec(e.id)?.[1] ?? 0)), 0);
  return `L-${max + 1}`;
}

/** Entries that still carry forward (not closed). */
export function openEntries(ledger: Ledger): LedgerEntry[] {
  return ledger.entries.filter((e) => e.status !== 'closed');
}
