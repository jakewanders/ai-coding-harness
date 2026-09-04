import '../gates/index.js';
import { type ModeDef } from '../modes.js';
import { type ResolvedGate } from '../registry/gates.js';
import { type ToolContext } from '../registry/tools.js';
import { type StageName } from '../store/state.js';
import { type LoadedUnit } from '../store/units.js';
export declare function modeFor(unit: LoadedUnit, ctx: ToolContext): ModeDef;
export declare function gatesForUnit(unit: LoadedUnit, ctx: ToolContext, stage: StageName): Promise<ResolvedGate[]>;
export declare const evidenceTool: import("../registry/tools.js").ToolDef;
