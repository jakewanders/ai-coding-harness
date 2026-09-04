import type { FindingSeverity } from '../evidence/kinds.js';
import type { ReviewVerdict } from '../store/state.js';

export interface ReviewFinding {
  severity: FindingSeverity;
  text: string;
  path?: string;
  line?: number;
}

export interface ReviewColumnRecord {
  column: string;
  findings: ReviewFinding[];
}

export interface Synthesis {
  verdict: ReviewVerdict;
  counts: Record<FindingSeverity, number>;
  missing_columns: string[];
}

/**
 * Merge review columns into one verdict: any blocker or any missing required
 * column → not_ready; any major → needs_attention; otherwise ship.
 */
export function synthesize(columns: ReviewColumnRecord[], required: string[]): Synthesis {
  const counts: Record<FindingSeverity, number> = { blocker: 0, major: 0, minor: 0, note: 0 };
  for (const c of columns) for (const f of c.findings) counts[f.severity] += 1;
  const present = new Set(columns.map((c) => c.column));
  const missing_columns = required.filter((r) => !present.has(r));
  const verdict: ReviewVerdict = counts.blocker > 0 || missing_columns.length > 0 ? 'not_ready' : counts.major > 0 ? 'needs_attention' : 'ship';
  return { verdict, counts, missing_columns };
}

/** Latest record per column among the given records (later wins). */
export function latestPerColumn(records: ReviewColumnRecord[]): ReviewColumnRecord[] {
  const byColumn = new Map<string, ReviewColumnRecord>();
  for (const r of records) byColumn.set(r.column, r);
  return [...byColumn.values()];
}
