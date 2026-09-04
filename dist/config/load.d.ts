import type { z } from 'zod';
import type { ConfigError } from '../contracts/header.js';
import { type HarnessConfig } from './schema.js';
import { type LocatedDocument } from './yaml.js';
export type { ConfigError } from '../contracts/header.js';
export type { HarnessConfig } from './schema.js';
export interface LayerReport {
    name: 'defaults' | 'kit' | 'user' | 'repo';
    file: string | null;
    ok: boolean;
    error?: ConfigError;
}
export interface LoadedConfig {
    config: HarnessConfig;
    layers: LayerReport[];
    errors: ConfigError[];
}
export declare const USER_CONFIG_RELATIVE: string;
export declare const REPO_CONFIG_FILE = ".harness.yaml";
export declare const MIGRATION_NOTE = "run `system config` to migrate";
/** Recursive merge: maps merge, lists and scalars replace, undefined is ignored. */
export declare function deepMerge<T>(base: T, over: Partial<T>): T;
/** Path to the user config file: HARNESS_CONFIG, else <home>/.harness/config.yaml. */
export declare function userConfigPath(env: NodeJS.ProcessEnv): string;
/** Walk up from `cwd` to the directory containing `.git`, or null. */
export declare function findGitRoot(cwd: string): string | null;
/** Keys allowed at the object found at `segments`, or undefined if not an object. */
export declare function validKeysAt(root: z.ZodTypeAny, segments: Array<string | number>): string[] | undefined;
/** Validate one layer's raw value. Returns the typed config or a single ConfigError. */
export declare function validateLayer(raw: unknown, file: string, located: LocatedDocument | null): {
    config: HarnessConfig;
} | {
    error: ConfigError;
};
/**
 * Load configuration: defaults → kit fragments → user file → repo file.
 * A broken layer is skipped and reported; this never throws.
 */
export declare function loadConfig(opts: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    kitFragments?: Partial<HarnessConfig>[];
}): LoadedConfig;
