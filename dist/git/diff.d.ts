export declare const DIFF_CAP_BYTES: number;
export declare function hasRemote(root: string): boolean;
/** `git fetch origin --prune`; ok without a remote (nothing to fetch). */
export declare function fetchOrigin(root: string): {
    ok: boolean;
    remote: boolean;
    detail: string;
};
export interface BaseRef {
    ref: string;
    remote: boolean;
    note: string | null;
}
/** `origin/<base>` when a remote exists, else the local base with a note. */
export declare function baseRefFor(root: string, baseBranch: string): BaseRef | {
    error: string;
};
/**
 * Refuse an explicit local ref when the same branch exists on origin: the
 * remote is the source of truth for what the unit changes.
 */
export declare function refuseLocalRef(root: string, ref: string): string | null;
export interface DiffResult {
    text: string;
    truncated: boolean;
    bytes: number;
}
/** Untracked, non-ignored files in the working tree. */
export declare function untrackedFiles(root: string): string[];
/**
 * Working tree against `ref`, optionally `--stat`, capped at 200 KB.
 * Untracked files are included as additions (git diff alone would skip them).
 */
export declare function diffAgainst(root: string, ref: string, stat: boolean): DiffResult | {
    error: string;
};
export interface StatusInfo {
    branch: string | null;
    upstream: string | null;
    ahead: number;
    behind: number;
    entries: string[];
    clean: boolean;
}
export declare function porcelainStatus(root: string): StatusInfo | {
    error: string;
};
/** Does `branch` match a protected pattern (`release/*` style globs allowed)? */
export declare function isProtected(branch: string, patterns: string[]): boolean;
