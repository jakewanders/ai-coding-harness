import type { UnitState } from '../store/state.js';
export interface LiveFacts {
    branch?: string;
    uncommitted?: boolean;
    pr_state?: 'open' | 'merged' | 'closed' | 'none';
    tracker_status?: string;
}
export type DisagreementKind = 'branch_differs' | 'uncommitted_work' | 'pr_merged_early' | 'pr_closed' | 'pr_missing_live' | 'pr_unrecorded' | 'tracker_status_differs';
export interface Disagreement {
    kind: DisagreementKind;
    detail: string;
}
/** Compare stored state with live facts the assistant gathered; never mutates. */
export declare function reconcile(state: UnitState, live: LiveFacts, opts?: {
    expectedTrackerStatus?: string | null;
}): Disagreement[];
