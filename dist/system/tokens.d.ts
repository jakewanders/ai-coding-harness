import type { ToolContext } from '../registry/tools.js';
import { type StageName } from '../store/state.js';
export interface TokenRow {
    stage: StageName;
    skill_bytes: number;
    mode_bytes: number;
    brief_bytes: number;
    bytes: number;
    tokens: number;
}
export interface TokenReport {
    mode: string;
    rows: TokenRow[];
    shared: {
        bytes: number;
        tokens: number;
        files: string[];
    };
    total: {
        bytes: number;
        tokens: number;
    };
}
/** Instruction load of a full run: skill, mode and rendered brief per core stage, plus shared prose. */
export declare function measureTokens(ctx: ToolContext, modeName?: string): TokenReport;
export declare function renderTokens(r: TokenReport): string;
