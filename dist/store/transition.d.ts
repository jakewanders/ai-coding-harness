import type { StageName, UnitState } from './state.js';
export interface Transition {
    state: UnitState;
    from: StageName;
    to: StageName;
    cycleIncremented: boolean;
}
/**
 * Move a unit to `to`: end the open timer, start one for the new stage, and
 * increment the cycle each time review starts again after the first time.
 */
export declare function applyTransition(state: UnitState, to: StageName, at: string): Transition;
