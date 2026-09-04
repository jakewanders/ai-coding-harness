import '../gates/index.js';
import { evidenceTool } from '../tools/evidence.js';
import { systemTool } from '../tools/system.js';
import { execTool } from '../tools/exec.js';
import { pullreqTool } from '../tools/pullreq.js';
import { specTool } from '../tools/spec.js';
import { unitTool } from '../tools/unit.js';
import { vcsTool } from '../tools/vcs.js';
/** Every tool the server exposes, in the order they appear in docs/tools.md. */
export function allTools() {
    return [unitTool, specTool, evidenceTool, execTool, vcsTool, pullreqTool, systemTool];
}
export function findTool(name) {
    return allTools().find((t) => t.name === name);
}
