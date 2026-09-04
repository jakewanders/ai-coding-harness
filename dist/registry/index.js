import { systemTool } from '../tools/system.js';
import { unitTool } from '../tools/unit.js';
/** Every tool the server exposes, in the order they appear in docs/tools.md. */
export function allTools() {
    return [unitTool, systemTool];
}
export function findTool(name) {
    return allTools().find((t) => t.name === name);
}
