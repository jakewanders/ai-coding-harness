import { git, remoteUrl } from '../git/exec.js';
/** Push/pull the vault's git remote when `store.remote` is configured; otherwise skip. */
export function syncVault(vault, remote) {
    if (!remote)
        return { ok: true, summary: 'sync skipped: no remote', detail: ['store.remote is not configured'] };
    const detail = [];
    if (!remoteUrl(vault)) {
        const add = git(['remote', 'add', 'origin', remote], vault);
        if (!add.ok)
            return { ok: false, summary: 'sync failed: cannot add remote', detail: [add.stderr] };
        detail.push(`added remote origin ${remote}`);
    }
    const commit = git(['add', '-A'], vault);
    if (commit.ok) {
        const c = git(['commit', '-q', '-m', 'harness sync'], vault);
        detail.push(c.ok ? 'committed local changes' : 'nothing to commit');
    }
    const pull = git(['pull', '--rebase', '--quiet', 'origin', 'HEAD'], vault);
    detail.push(pull.ok ? 'pulled' : `pull: ${pull.stderr || 'nothing to pull'}`);
    const push = git(['push', '--quiet', 'origin', 'HEAD'], vault);
    detail.push(push.ok ? 'pushed' : `push failed: ${push.stderr}`);
    return { ok: push.ok, summary: push.ok ? 'sync complete' : 'sync failed', detail };
}
