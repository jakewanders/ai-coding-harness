import type { UnitState } from './state.js';
export declare class UnknownSchemaError extends Error {
    readonly schema: unknown;
    constructor(schema: unknown);
}
type Raw = Record<string, unknown>;
type Step = (raw: Raw) => Raw;
/** Map old stage names in `stage`, every timer and every report onto the current pipeline. */
export declare function normalizeStages(raw: Raw): Raw;
/** `n → n+1` steps keyed by the schema they upgrade from. */
export declare const MIGRATIONS: Record<number, Step>;
/** Lift any known state shape to the current schema and validate it. */
export declare function migrate(raw: unknown): UnitState;
export {};
