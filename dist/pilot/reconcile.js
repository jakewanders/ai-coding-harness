const COMMITTED_STAGES = ['review', 'challenge', 'verify', 'publish', 'close'];
/** Compare stored state with live facts the assistant gathered; never mutates. */
export function reconcile(state, live, opts = {}) {
    const out = [];
    if (live.branch !== undefined && state.branch && live.branch !== state.branch) {
        out.push({ kind: 'branch_differs', detail: `state records branch ${state.branch} but the checkout is on ${live.branch}` });
    }
    if (live.uncommitted === true && COMMITTED_STAGES.includes(state.stage)) {
        out.push({ kind: 'uncommitted_work', detail: `uncommitted work in the worktree while stage is ${state.stage}` });
    }
    if (live.pr_state !== undefined) {
        if (live.pr_state === 'merged' && state.stage !== 'close') {
            out.push({ kind: 'pr_merged_early', detail: `pull request is merged while stage is ${state.stage}` });
        }
        else if (live.pr_state === 'closed' && state.stage !== 'close') {
            out.push({ kind: 'pr_closed', detail: `pull request is closed without merge while stage is ${state.stage}` });
        }
        if (live.pr_state === 'none' && state.pr) {
            out.push({ kind: 'pr_missing_live', detail: `state records ${state.pr.url} but no pull request exists live` });
        }
        if (live.pr_state !== 'none' && !state.pr) {
            out.push({ kind: 'pr_unrecorded', detail: `a pull request is ${live.pr_state} live but none is recorded; use pullreq record` });
        }
    }
    if (live.tracker_status !== undefined && opts.expectedTrackerStatus && live.tracker_status !== opts.expectedTrackerStatus) {
        out.push({ kind: 'tracker_status_differs', detail: `tracker shows "${live.tracker_status}" but stage ${state.stage} expects "${opts.expectedTrackerStatus}"` });
    }
    return out;
}
