import type { ToolDef } from './tools.js';
import { systemTool } from '../tools/system.js';
import { unitTool } from '../tools/unit.js';

/** Every tool the server exposes, in the order they appear in docs/tools.md. */
export function allTools(): ToolDef[] {
  return [unitTool, systemTool];
}

export function findTool(name: string): ToolDef | undefined {
  return allTools().find((t) => t.name === name);
}
