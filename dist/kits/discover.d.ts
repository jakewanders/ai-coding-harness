import type { ConfigError } from '../contracts/header.js';
import { type Kit } from './manifest.js';
export type { Kit, KitDoc } from './manifest.js';
/**
 * Kit search path, in order: HARNESS_KIT_PATHS (colon-separated),
 * ~/.harness/kits, the plugin manager cache (<pluginRoot>/../../cache/*\/kits),
 * then the sibling kits checkout <pluginRoot>/../ai-coding-harness-kits/kits.
 */
export declare function kitSearchPaths(env: NodeJS.ProcessEnv, home: string, pluginRoot: string): string[];
export interface Discovery {
    kits: Kit[];
    errors: ConfigError[];
    missing: string[];
}
/** Find each named kit along the search path; the first directory containing it wins. */
export declare function discoverKitsDetailed(names: string[], env: NodeJS.ProcessEnv, home: string, pluginRoot: string): Discovery;
export declare function discoverKits(names: string[], env: NodeJS.ProcessEnv, home: string, pluginRoot: string): Kit[];
