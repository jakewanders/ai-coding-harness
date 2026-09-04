import { systemTool } from '../tools/system.js';
/** Every tool the server exposes, in the order they appear in docs/tools.md. */
export function allTools() {
    return [systemTool];
}
export function findTool(name) {
    return allTools().find((t) => t.name === name);
}
