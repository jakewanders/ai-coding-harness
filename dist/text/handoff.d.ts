import type { Requirement } from '../spec/requirement.js';
import type { Digest } from '../store/index.js';
import type { UnitState } from '../store/state.js';
export interface HandoffOptions {
    next: string | null;
    questions?: string[];
}
/** Where things stand, open questions, next action. */
export declare function renderHandoff(state: UnitState, requirement: Requirement | null, digest: Digest | null, opts: HandoffOptions): string;
