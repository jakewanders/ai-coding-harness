import { type ToolDef } from '../registry/tools.js';
/** Markdown inventory: a tool table, then one section per tool listing its actions. */
export declare function renderToolsDoc(tools: ToolDef[]): string;
export declare function writeToolsDoc(root: string): string;
