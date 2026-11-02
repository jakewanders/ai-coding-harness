import { type RoleName } from '../contracts/header.js';
/** Roles → tool names, in input order; tools matching nothing are left out. */
export declare function mapToolsToRoles(toolNames: string[]): Record<RoleName, string[]>;
/** Tools that mapped to no role. */
export declare function unmappedTools(toolNames: string[], roles?: Record<RoleName, string[]>): string[];
