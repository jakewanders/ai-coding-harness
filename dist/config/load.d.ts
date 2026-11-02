import type { ConfigError } from '../contracts/header.js';
import type { HarnessConfig } from './schema.js';
import { type Kit } from '../kits/discover.js';
export type { ConfigError } from '../contracts/header.js';
export type { HarnessConfig } from './schema.js';
export { MIGRATION_NOTE, validKeysAt, validateLayer } from './validate.js';
export interface LayerReport {
    name: 'defaults' | 'kit' | 'user' | 'repo';
    file: string | null;
    ok: boolean;
    error?: ConfigError;
    /** Deprecated keys upgraded in memory while loading this layer. */
    deprecations?: string[];
}
export interface LoadedConfig {
    config: HarnessConfig;
    layers: LayerReport[];
    errors: ConfigError[];
    /** Kits discovered from the merged `kits` list (empty when none). */
    kits: Kit[];
    /** Deprecated keys upgraded in memory, one note each. */
    deprecations?: string[];
}
export declare const USER_CONFIG_RELATIVE: string;
export declare const REPO_CONFIG_FILE = ".harness.yaml";
/** Recursive merge: maps merge, lists and scalars replace, undefined is ignored. */
export declare function deepMerge<T>(base: T, over: Partial<T>): T;
/** Path to the user config file: HARNESS_CONFIG, else <home>/.harness/config.yaml. */
export declare function userConfigPath(env: NodeJS.ProcessEnv): string;
/** Walk up from `cwd` to the directory containing `.git`, or null. */
export declare function findGitRoot(cwd: string): string | null;
export declare function loadFileLayer(name: 'user' | 'repo', file: string | null): {
    report: LayerReport;
    config: HarnessConfig | null;
};
export interface LoadOptions {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    kitFragments?: Partial<HarnessConfig>[];
    /** Plugin install root, for the kit search path; defaults to the process cwd. */
    pluginRoot?: string;
}
/**
 * Load configuration: defaults → kit fragments → user file → repo file.
 * Kits named by the user and repo layers are discovered along the kit search
 * path and merged below them. A broken layer is skipped and reported; this
 * never throws.
 */
export declare function loadConfig(opts: LoadOptions): LoadedConfig;
