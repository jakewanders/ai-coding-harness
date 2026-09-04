import type { ToolDef } from './tools.js';
import '../flows/index.js';
import '../gates/index.js';
import { analyzeTool } from '../tools/analyze.js';
import { diffauditTool } from '../tools/diffaudit.js';
import { digestTool } from '../tools/digest.js';
import { evidenceTool } from '../tools/evidence.js';
import { recallTool } from '../tools/recall.js';
import { systemTool } from '../tools/system.js';
import { execTool } from '../tools/exec.js';
import { pullreqTool } from '../tools/pullreq.js';
import { specTool } from '../tools/spec.js';
import { unitTool } from '../tools/unit.js';
import { vcsTool } from '../tools/vcs.js';

/** Every tool the server exposes, in the order they appear in docs/tools.md. */
export function allTools(): ToolDef[] {
  return [unitTool, specTool, analyzeTool, evidenceTool, diffauditTool, execTool, vcsTool, pullreqTool, digestTool, recallTool, systemTool];
}

export function findTool(name: string): ToolDef | undefined {
  return allTools().find((t) => t.name === name);
}
