import { type ToolContext } from '../registry/tools.js';
import { type LoadedUnit } from '../store/units.js';
export declare const DEFAULT_TIMEOUT_MS: number;
export declare const SUMMARY_LINES = 20;
export interface ProfileCommands {
    commands: Record<string, string>;
    inferred: boolean;
    evidence: Record<string, string>;
}
/** Configured commands for the unit's repo, else inferred ones flagged as such. */
export declare function profileCommands(ctx: ToolContext, unit: LoadedUnit): ProfileCommands;
export declare const execTool: import("../registry/tools.js").ToolDef;
