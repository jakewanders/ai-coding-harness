import fs from 'node:fs';
import path from 'node:path';
import { git } from './exec.js';
/** Sibling directory `../<repo>-<id>` for a unit's worktree. */
export function worktreePathFor(repoRoot, id) {
    return path.join(path.dirname(repoRoot), `${path.basename(repoRoot)}-${id}`);
}
export function branchExists(root, name) {
    return git(['show-ref', '--verify', '--quiet', `refs/heads/${name}`], root).ok;
}
export function refExists(root, ref) {
    return git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root).ok;
}
/** Create `name` from `base` or check it out if it exists. Returns whether it was created. */
export function createOrCheckoutBranch(root, name, base) {
    if (branchExists(root, name)) {
        const r = git(['checkout', '-q', name], root);
        return { ok: r.ok, created: false, ...(r.ok ? {} : { error: r.stderr }) };
    }
    const r = git(['checkout', '-q', '-b', name, base], root);
    return { ok: r.ok, created: true, ...(r.ok ? {} : { error: r.stderr }) };
}
/** Add a worktree at `dir` on `branch`, creating the branch from `base` when needed. */
export function addWorktree(root, dir, branch, base) {
    const args = branchExists(root, branch) ? ['worktree', 'add', dir, branch] : ['worktree', 'add', '-b', branch, dir, base];
    const r = git(args, root);
    return r.ok ? { ok: true } : { ok: false, error: r.stderr || r.stdout };
}
export function listWorktrees(root) {
    const r = git(['worktree', 'list', '--porcelain'], root);
    if (!r.ok)
        return [];
    return r.stdout.split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice('worktree '.length));
}
export function removeWorktree(root, dir) {
    const registered = listWorktrees(root).some((w) => path.resolve(w) === path.resolve(dir));
    if (registered) {
        const r = git(['worktree', 'remove', '--force', dir], root);
        if (!r.ok)
            return { ok: false, error: r.stderr };
    }
    else if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    git(['worktree', 'prune'], root);
    return { ok: true };
}
/** Is `branch` fully contained in `into`? */
export function isMerged(root, branch, into) {
    return git(['merge-base', '--is-ancestor', branch, into], root).ok;
}
export function deleteBranch(root, name, force = false) {
    const r = git(['branch', force ? '-D' : '-d', name], root);
    return r.ok ? { ok: true } : { ok: false, error: r.stderr };
}
