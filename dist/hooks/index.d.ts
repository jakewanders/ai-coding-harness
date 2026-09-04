import { type Decision } from './adapter.js';
/** Entry called by hooks/guard.mjs: guard name plus the host payload (already parsed). */
export declare function runHook(guard: string, payload: unknown): Promise<Decision>;
export { parseHostPayload, renderDecision } from './adapter.js';
export { runPreBash, runStop } from './guards.js';
export { resolveUnit } from './resolve-unit.js';
