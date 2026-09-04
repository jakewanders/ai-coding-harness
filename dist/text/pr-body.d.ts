import { type ModeDef } from '../modes.js';
import type { Requirement } from '../spec/requirement.js';
import type { UnitState } from '../store/state.js';
export interface PrBodyOptions {
    /** plan.md text; its `## Deferred` bullets become the Not built list. */
    plan?: string | null;
}
/** Bullets under a `## Deferred` heading in plan.md. */
export declare function parseDeferred(plan: string | null | undefined): string[];
/** The ghostwritten PR body assembled from the unit record. */
export declare function renderPrBody(state: UnitState, requirement: Requirement | null, mode: ModeDef, opts?: PrBodyOptions): string;
