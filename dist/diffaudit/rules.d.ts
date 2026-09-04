import type { Hunkfile } from '../analysis/diff-parse.js';
import type { HarnessConfig } from '../config/schema.js';
import type { FindingSeverity } from '../evidence/kinds.js';
export interface Rule {
    id: string;
    pattern: string;
    files: string;
    severity: FindingSeverity;
    message: string;
}
export interface RuleFinding {
    severity: FindingSeverity;
    text: string;
    path: string;
    line: number;
    rule: string;
}
/** Rules from the merged config (kit fragments are already merged into it). */
export declare function loadRules(config: HarnessConfig): Rule[];
/** Match each rule's pattern against added lines in files matching its glob; invalid patterns are skipped. */
export declare function runRules(rules: Rule[], diff: Hunkfile[]): RuleFinding[];
