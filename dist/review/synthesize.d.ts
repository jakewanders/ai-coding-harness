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
export declare function synthesize(columns: ReviewColumnRecord[], required: string[]): Synthesis;
/** Latest record per column among the given records (later wins). */
export declare function latestPerColumn(records: ReviewColumnRecord[]): ReviewColumnRecord[];
