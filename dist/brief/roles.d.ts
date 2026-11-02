import type { HarnessConfig } from '../config/schema.js';
import { type RoleName } from '../contracts/header.js';
export declare const UNWIRED_NOTE = "unwired \u2014 skip steps that need it and say so";
/** Tool names wired to each role, or `unwired`. */
export declare function roleWiring(config: HarnessConfig): Record<RoleName, string[] | 'unwired'>;
/** Markdown block listing every role and what fills it. */
export declare function buildRoleBlock(config: HarnessConfig): string;
