import type { ToolDef } from './tools.js';
import '../gates/index.js';
/** Every tool the server exposes, in the order they appear in docs/tools.md. */
export declare function allTools(): ToolDef[];
export declare function findTool(name: string): ToolDef | undefined;
