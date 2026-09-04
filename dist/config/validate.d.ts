import type { z } from 'zod';
import type { ConfigError } from '../contracts/header.js';
import { type HarnessConfig } from './schema.js';
import { type LocatedDocument } from './yaml.js';
export declare const MIGRATION_NOTE = "run `system config` to migrate";
/** Keys allowed at the object found at `segments`, or undefined if not an object. */
export declare function validKeysAt(root: z.ZodTypeAny, segments: Array<string | number>): string[] | undefined;
/** Validate one layer's raw value. Returns the typed config or a single ConfigError. */
export declare function validateLayer(raw: unknown, file: string, located: LocatedDocument | null): {
    config: HarnessConfig;
} | {
    error: ConfigError;
};
