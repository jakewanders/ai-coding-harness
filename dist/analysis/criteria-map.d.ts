import type { Criterion } from '../spec/requirement.js';
import type { Hunkfile } from './diff-parse.js';
export interface CriterionMatch {
    criterion: Criterion;
    files: string[];
    terms: string[];
}
export interface CriteriaMap {
    matched: CriterionMatch[];
    unproven: Criterion[];
    orphan_hunks: Hunkfile[];
}
/** Keyword overlap between criterion text and hunk text or path, both directions. */
export declare function criteriaMap(criteria: Criterion[], diff: Hunkfile[]): CriteriaMap;
