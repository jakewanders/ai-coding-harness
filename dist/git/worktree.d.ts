/** Sibling directory `../<repo>-<id>` for a unit's worktree. */
export declare function worktreePathFor(repoRoot: string, id: string): string;
export declare function branchExists(root: string, name: string): boolean;
export declare function refExists(root: string, ref: string): boolean;
/** Create `name` from `base` or check it out if it exists. Returns whether it was created. */
export declare function createOrCheckoutBranch(root: string, name: string, base: string): {
    ok: boolean;
    created: boolean;
    error?: string;
};
/** Add a worktree at `dir` on `branch`, creating the branch from `base` when needed. */
export declare function addWorktree(root: string, dir: string, branch: string, base: string): {
    ok: boolean;
    error?: string;
};
export declare function listWorktrees(root: string): string[];
export declare function removeWorktree(root: string, dir: string): {
    ok: boolean;
    error?: string;
};
/** Is `branch` fully contained in `into`? */
export declare function isMerged(root: string, branch: string, into: string): boolean;
export declare function deleteBranch(root: string, name: string, force?: boolean): {
    ok: boolean;
    error?: string;
};
