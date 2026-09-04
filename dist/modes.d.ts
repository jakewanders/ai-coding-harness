import type { HarnessConfig } from './config/schema.js';
import type { Severity } from './contracts/header.js';
import type { StageName } from './store/state.js';
export interface ModeDef {
    name: string;
    extends: string | null;
    demote: Record<string, Severity>;
    merge_dispatches: boolean;
    verify_after_publish: boolean;
    skip_stages: StageName[];
    banner: string | null;
}
export declare class UnknownModeError extends Error {
    readonly mode: string;
    constructor(mode: string);
}
export declare const SKETCH_BANNER = "Nothing reviewed this diff: sketch mode skipped review, challenge and verify.";
/** Built-in run modes per spec section 8. */
export declare const BUILT_IN_MODES: Record<'thorough' | 'express' | 'sketch', ModeDef>;
/**
 * Resolve a mode by name: built-ins first, layered with any `config.modes`
 * entry of the same name; custom modes extend their parent (default thorough).
 */
export declare function resolveMode(name: string, config: HarnessConfig, seen?: string[]): ModeDef;
/**
 * The demotions a mode really applies, sorted by gate id. An entry that would
 * raise a gate above its registered default is not a demotion and is dropped.
 */
export declare function demotionsOf(mode: ModeDef): Array<{
    gate: string;
    to: Severity;
}>;
