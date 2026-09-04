import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { type ToolContext } from './registry/tools.js';
/** Plugin install root: the directory containing dist/, skills/, hooks/. */
export declare function pluginRoot(): string;
/** Build the tool context for a process: config from cwd + env, vault, root. */
export declare function makeContext(cwd?: string, env?: NodeJS.ProcessEnv): ToolContext;
/** MCP server exposing every registered tool; the transport is attached by the caller. */
export declare function createServer(ctx: ToolContext): Server;
export declare function main(): Promise<void>;
