import type { UnitState } from '../store/state.js';
export interface ResolvedUnit {
    id: string;
    dir: string;
    state: UnitState;
}
/** The unit implied by the checked-out branch in `cwd`, with its record, or null. */
export declare function resolveUnitRecord(cwd: string, vault: string): ResolvedUnit | null;
/** The unit state implied by the current branch, or null (guards stay silent). */
export declare function resolveUnit(cwd: string, vault: string): UnitState | null;
