export interface GitResult {
    ok: boolean;
    stdout: string;
    stderr: string;
}
/** Run git synchronously in `cwd`. Never throws; a missing binary reports ok: false. */
export declare function git(args: string[], cwd: string): GitResult;
/** Top-level directory of the checkout containing `cwd`, or null. */
export declare function gitRoot(cwd: string): string | null;
/** The `origin` remote url, or null when there is no origin. */
export declare function remoteUrl(cwd: string): string | null;
/** Name of the branch currently checked out, or null when detached or not a repo. */
export declare function currentBranch(cwd: string): string | null;
/**
 * Default branch: what origin/HEAD points at, else `main` if it exists, else
 * `master`, else the current branch. Outside a repository returns `main`.
 */
export declare function defaultBranch(cwd: string): string;
