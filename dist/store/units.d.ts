import type { ToolContext } from '../registry/tools.js';
import { type UnitState } from './state.js';
/** Repo namespace for the checkout containing `cwd` (or `local/<dir>` outside git). */
export declare function namespaceFor(cwd: string): string;
export declare function unitDirFor(ctx: ToolContext, id: string): string;
/** Ids of every unit recorded under the namespace, sorted. */
export declare function listUnitIds(vault: string, ns: string): string[];
export interface LoadedUnit {
    id: string;
    dir: string;
    state: UnitState;
}
/** Load a unit by id, or null when it does not exist in the current namespace. */
export declare function loadUnit(ctx: ToolContext, id: string): LoadedUnit | null;
/** Unit id implied by the checked-out branch, or null. */
export declare function unitFromCwd(ctx: ToolContext): string | null;
/** Resolve `id` when given, else the branch-implied unit. */
export declare function resolveUnit(ctx: ToolContext, id?: string | null): LoadedUnit | null;
/** Pinned source text for a unit, or null when nothing was pinned. */
export declare function readSource(dir: string): string | null;
