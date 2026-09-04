import type { ModeDef } from '../modes.js';
import type { Requirement } from '../spec/requirement.js';
import type { StageName, UnitState } from '../store/state.js';
export interface WrapupOptions {
    plan?: string | null;
    drafts?: string[];
    now?: Date;
}
export interface StageRow {
    stage: StageName;
    minutes: number;
    commits: number;
    started_at: string;
}
/** One row per timed stage, in order of first start, with minutes and commits made during it. */
export declare function stageTable(state: UnitState, now?: Date): StageRow[];
/** Wrap-up summary at the end of a run. */
export declare function renderWrapup(state: UnitState, requirement: Requirement | null, mode: ModeDef, opts?: WrapupOptions): string;
