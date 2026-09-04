import { systemTool } from '../tools/system.js';
import { execTool } from '../tools/exec.js';
import { specTool } from '../tools/spec.js';
import { unitTool } from '../tools/unit.js';
/** Every tool the server exposes, in the order they appear in docs/tools.md. */
export function allTools() {
    return [unitTool, specTool, execTool, systemTool];
}
export function findTool(name) {
    return allTools().find((t) => t.name === name);
}
