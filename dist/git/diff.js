import { git, remoteUrl } from './exec.js';
import { refExists } from './worktree.js';
export const DIFF_CAP_BYTES = 200 * 1024;
export function hasRemote(root) {
    return remoteUrl(root) !== null;
}
/** `git fetch origin --prune`; ok without a remote (nothing to fetch). */
export function fetchOrigin(root) {
    if (!hasRemote(root))
        return { ok: true, remote: false, detail: 'no remote configured; nothing fetched' };
    const r = git(['fetch', 'origin', '--prune', '--quiet'], root);
    return { ok: r.ok, remote: true, detail: r.ok ? 'fetched origin' : r.stderr };
}
/** `origin/<base>` when a remote exists, else the local base with a note. */
export function baseRefFor(root, baseBranch) {
    if (hasRemote(root)) {
        const ref = `origin/${baseBranch}`;
        if (!refExists(root, ref))
            return { error: `${ref} does not exist after fetch; check the base branch name` };
        return { ref, remote: true, note: null };
    }
    if (!refExists(root, baseBranch))
        return { error: `local branch ${baseBranch} does not exist and there is no remote` };
    return { ref: baseBranch, remote: false, note: `no remote configured; comparing against local ${baseBranch}` };
}
/**
 * Refuse an explicit local ref when the same branch exists on origin: the
 * remote is the source of truth for what the unit changes.
 */
export function refuseLocalRef(root, ref) {
    if (!hasRemote(root) || ref.startsWith('origin/') || ref === 'HEAD')
        return null;
    if (refExists(root, `refs/heads/${ref}`) && refExists(root, `origin/${ref}`)) {
        return `refusing to diff against local "${ref}" while a remote exists; use origin/${ref} (the default) so remote commits are included`;
    }
    return null;
}
/** Untracked, non-ignored files in the working tree. */
export function untrackedFiles(root) {
    const r = git(['ls-files', '--others', '--exclude-standard'], root);
    return r.ok && r.stdout ? r.stdout.split('\n').filter(Boolean) : [];
}
/**
 * Working tree against `ref`, optionally `--stat`, capped at 200 KB.
 * Untracked files are included as additions (git diff alone would skip them).
 */
export function diffAgainst(root, ref, stat) {
    const r = git(['diff', ...(stat ? ['--stat'] : []), ref], root);
    if (!r.ok)
        return { error: r.stderr || `git diff ${ref} failed` };
    const parts = [r.stdout.trimEnd()];
    for (const file of untrackedFiles(root)) {
        const u = git(['diff', '--no-index', ...(stat ? ['--stat'] : []), '--', '/dev/null', file], root);
        if (u.stdout.trim())
            parts.push(u.stdout.trimEnd());
    }
    const full = parts.filter(Boolean).join('\n') + (parts.some(Boolean) ? '\n' : '');
    const bytes = Buffer.byteLength(full, 'utf8');
    if (bytes <= DIFF_CAP_BYTES)
        return { text: full, truncated: false, bytes };
    const cut = Buffer.from(full, 'utf8').subarray(0, DIFF_CAP_BYTES).toString('utf8');
    return { text: `${cut}\n\n[diff truncated at ${DIFF_CAP_BYTES} bytes of ${bytes}; use stat: true or narrow the change]`, truncated: true, bytes };
}
export function porcelainStatus(root) {
    const r = git(['status', '--porcelain=v1', '--branch'], root);
    if (!r.ok)
        return { error: r.stderr };
    const lines = r.stdout.split('\n').filter((l) => l.length > 0);
    const head = lines.find((l) => l.startsWith('## ')) ?? '## ';
    const entries = lines.filter((l) => !l.startsWith('## '));
    const m = /^## ([^.\s]+)(?:\.\.\.(\S+))?(?: \[(.*)\])?/.exec(head);
    const ahead = Number(/ahead (\d+)/.exec(m?.[3] ?? '')?.[1] ?? 0);
    const behind = Number(/behind (\d+)/.exec(m?.[3] ?? '')?.[1] ?? 0);
    return { branch: m?.[1] ?? null, upstream: m?.[2] ?? null, ahead, behind, entries, clean: entries.length === 0 };
}
/** Does `branch` match a protected pattern (`release/*` style globs allowed)? */
export function isProtected(branch, patterns) {
    return patterns.some((p) => {
        const re = new RegExp(`^${p.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
        return re.test(branch);
    });
}
