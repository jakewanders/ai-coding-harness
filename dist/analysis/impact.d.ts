import type { DiffLine, Hunkfile } from './diff-parse.js';
export interface ChangedExport {
    file: string;
    name: string;
}
export interface Consumer {
    file: string;
    imports: string[];
}
export interface ImpactRadius {
    changed_exports: ChangedExport[];
    consumers: Consumer[];
}
/** Exported names declared on added lines. */
export declare function changedExports(file: string, added: DiffLine[]): ChangedExport[];
/** Changed exports and the files that import them, across the tracked worktree. */
export declare function impactRadius(diff: Hunkfile[], worktree: string): ImpactRadius;
