import { spawnSync } from 'node:child_process';
import path from 'node:path';
/** Run git synchronously in `cwd`. Never throws; a missing binary reports ok: false. */
export function git(args, cwd) {
    try {
        const r = spawnSync('git', args, {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
        });
        if (r.error)
            return { ok: false, stdout: '', stderr: r.error.message };
        return { ok: r.status === 0, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() };
    }
    catch (e) {
        return { ok: false, stdout: '', stderr: e.message };
    }
}
/** Top-level directory of the checkout containing `cwd`, or null. */
export function gitRoot(cwd) {
    const r = git(['rev-parse', '--show-toplevel'], cwd);
    return r.ok && r.stdout ? path.resolve(r.stdout) : null;
}
/** The `origin` remote url, or null when there is no origin. */
export function remoteUrl(cwd) {
    const r = git(['remote', 'get-url', 'origin'], cwd);
    return r.ok && r.stdout ? r.stdout : null;
}
/** Name of the branch currently checked out, or null when detached or not a repo. */
export function currentBranch(cwd) {
    const r = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd);
    return r.ok && r.stdout ? r.stdout : null;
}
function branchExists(name, cwd) {
    return git(['show-ref', '--verify', '--quiet', `refs/heads/${name}`], cwd).ok;
}
/**
 * Default branch: what origin/HEAD points at, else `main` if it exists, else
 * `master`, else the current branch. Outside a repository returns `main`.
 */
export function defaultBranch(cwd) {
    const head = git(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], cwd);
    if (head.ok && head.stdout.startsWith('origin/'))
        return head.stdout.slice('origin/'.length);
    if (branchExists('main', cwd))
        return 'main';
    if (branchExists('master', cwd))
        return 'master';
    return currentBranch(cwd) ?? 'main';
}
