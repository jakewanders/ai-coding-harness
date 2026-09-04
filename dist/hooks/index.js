import { parseHostPayload, renderDecision } from './adapter.js';
import { runPreBash, runStop } from './guards.js';
/** Entry called by hooks/guard.mjs: guard name plus the host payload (already parsed). */
export async function runHook(guard, payload) {
    const parsed = parseHostPayload(JSON.stringify(payload ?? {}), guard);
    const deps = { env: process.env, now: () => new Date() };
    if (parsed.event === 'stop') {
        const { message } = await runStop(parsed, deps);
        return renderDecision(false, message ? `harness: ${message}` : '');
    }
    const r = await runPreBash(parsed, deps);
    return renderDecision(r.block, r.messages.join('\n'));
}
export { parseHostPayload, renderDecision } from './adapter.js';
export { runPreBash, runStop } from './guards.js';
export { resolveUnit } from './resolve-unit.js';
