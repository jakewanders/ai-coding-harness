import type { Hunkfile } from './diff-parse.js';
export interface ReachSubjects {
    e2e_globs: string[];
    mock_globs: string[];
    contract_globs: string[];
}
export type SubjectKind = 'e2e' | 'mock' | 'contract';
export interface Surface {
    surface: string;
    kind: 'file' | 'export' | 'route';
    covered_by: string[];
    /** Kind of each covering subject, parallel to covered_by. */
    covered_kinds: SubjectKind[];
}
export declare const DEFAULT_SUBJECTS: ReachSubjects;
/** New files, exports and routes introduced by the diff. */
export declare function surfacesOf(diff: Hunkfile[]): Array<{
    surface: string;
    kind: Surface['kind'];
}>;
/** For each new surface, the subject files (e2e, mock, contract) that mention it. */
export declare function reachAudit(diff: Hunkfile[], subjects: ReachSubjects, worktree: string): Surface[];
