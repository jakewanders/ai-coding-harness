import type { LoadedConfig } from '../config/load.js';
import { type ModeDef } from '../modes.js';
import { type BriefHeader } from '../contracts/header.js';
import type { ResolvedGate } from '../registry/gates.js';
import { type BriefContext } from '../registry/stages.js';
import type { UnitState } from '../store/state.js';
export declare const STOP_BANNER = "Stop after this stage and report to the user.";
export declare const NO_UNIT = "(none)";
export interface HeaderInputs {
    state: UnitState | null;
    stage: string;
    config: LoadedConfig;
    namespace: string;
    root: string;
    gates: ResolvedGate[];
    docs?: string[];
    baseBranch?: string;
}
export declare function buildHeader(h: HeaderInputs): BriefHeader;
/** `## Mode`: name, demotions, skipped stages, ordering notes, banner, and the stage's mode notes when shipped. */
export declare function modeBlock(ctx: BriefContext, mode?: ModeDef): string[];
/** Full brief: header, roles, config problems, mode, source, stage material, stop banner. */
export declare function renderBrief(ctx: BriefContext): string;
