import type { ModeDef } from '../modes.js';
import { type FlowName } from '../registry/stages.js';
import type { ReviewVerdict, StageName, UnitState } from '../store/state.js';
export type Decision = 'proceed' | 'retry' | 'blocked' | 'done';
export interface Route {
    /** A core stage, the standalone `respond` flow for a bot round, or null when done. */
    next: StageName | FlowName | null;
    decision: Decision;
    verdict?: ReviewVerdict;
    questions: string[];
}
export declare const MAX_REVIEW_CYCLES = 4;
export declare const MAX_COMMIT_FAILURES = 2;
export declare const MAX_OTHER_FAILURES = 1;
export declare const MAX_BOT_ROUNDS = 2;
/**
 * Decide what the conductor does next from the unit's reports for the
 * current stage and cycle. Pure: never mutates the state. With a wired
 * reviewbot seat, a publish report routes to the respond flow while the bot
 * requests changes and the round cap is not exceeded.
 */
export declare function routeNext(state: UnitState, mode: ModeDef, browserUi?: boolean, reviewbotWired?: boolean): Route;
