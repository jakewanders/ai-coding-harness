import type { LoadedConfig } from '../config/load.js';
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
/** Full brief: header, seats, config problems, source, stage material, stop banner. */
export declare function renderBrief(ctx: BriefContext): string;
