import type { ModeDef } from '../modes.js';
import type { ReviewVerdict, StageName, UnitState } from '../store/state.js';
export type Decision = 'proceed' | 'retry' | 'blocked' | 'done';
export interface Route {
    next: StageName | null;
    decision: Decision;
    verdict?: ReviewVerdict;
    questions: string[];
}
export declare const MAX_REVIEW_CYCLES = 4;
export declare const MAX_COMMIT_FAILURES = 2;
export declare const MAX_OTHER_FAILURES = 1;
/**
 * Decide what the conductor does next from the unit's reports for the
 * current stage and cycle. Pure: never mutates the state.
 */
export declare function routeNext(state: UnitState, mode: ModeDef, browserUi?: boolean): Route;
