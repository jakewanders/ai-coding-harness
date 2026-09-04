import { spawnSync } from 'node:child_process';
export const SEVERITY_RANK = { block: 2, warn: 1, off: 0 };
export function defineGate(def) {
    return def;
}
const registry = [];
/** Add a gate to the registry; the gate modules call this at import time. */
export function registerGate(def) {
    if (!registry.some((g) => g.id === def.id))
        registry.push(def);
    return def;
}
export function allGates() {
    return [...registry];
}
export const CUSTOM_GATE_TIMEOUT_MS = 60_000;
/** Does the unit's repo profile declare `capability` truthy? */
export function hasCapability(config, repo, capability) {
    const caps = config.repos?.[repo]?.capabilities;
    return Boolean(caps?.[capability]);
}
function runShellGate(command, cwd) {
    const r = spawnSync('sh', ['-c', command], {
        cwd,
        encoding: 'utf8',
        timeout: CUSTOM_GATE_TIMEOUT_MS,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (r.error)
        return { pass: false, remedy: r.error.message };
    if (r.status === 0)
        return { pass: true };
    const detail = (r.stderr || r.stdout || '').trim();
    return { pass: false, remedy: detail ? `command failed (exit ${r.status}): ${detail}` : `command failed (exit ${r.status})` };
}
async function evaluate(gate, check) {
    if (gate.severity === 'off')
        return { ...gate, status: 'n/a' };
    try {
        const outcome = await check();
        if (outcome.applicable === false)
            return { ...gate, status: 'n/a' };
        return outcome.pass ? { ...gate, status: 'pass' } : { ...gate, status: 'fail', ...(outcome.remedy ? { remedy: outcome.remedy } : {}) };
    }
    catch (e) {
        return { ...gate, status: 'fail', remedy: `gate check threw: ${e instanceof Error ? e.message : String(e)}` };
    }
}
/**
 * Resolve the gates guarding `stage`: apply `requires`, config overrides,
 * mode demotions (downward only), append custom shell gates, then run checks.
 */
export async function resolveGates(stage, ctx, mode, gates = allGates()) {
    const out = [];
    for (const def of gates.filter((g) => g.stage === stage)) {
        const override = ctx.config.gates?.[def.id];
        const requires = override && 'requires' in override ? override.requires : def.requires;
        let gate = { id: def.id, severity: def.severity, status: 'n/a' };
        if (override?.severity && override.severity !== gate.severity) {
            gate = { ...gate, severity: override.severity, demoted_by: 'config' };
        }
        const demote = mode.demote[def.id];
        if (demote) {
            if (SEVERITY_RANK[demote] < SEVERITY_RANK[gate.severity])
                gate = { ...gate, severity: demote, demoted_by: 'mode' };
            else if (SEVERITY_RANK[demote] > SEVERITY_RANK[gate.severity])
                gate = { ...gate, ignored_promotion: demote };
        }
        if (requires && !hasCapability(ctx.config, ctx.state.repo, requires)) {
            out.push({ ...gate, status: 'n/a' });
            continue;
        }
        out.push(await evaluate(gate, () => def.check(ctx)));
    }
    for (const custom of (ctx.config.custom_gates ?? []).filter((g) => g.stage === stage)) {
        let gate = { id: custom.id, severity: custom.severity ?? 'warn', status: 'n/a' };
        const demote = mode.demote[custom.id];
        if (demote && SEVERITY_RANK[demote] < SEVERITY_RANK[gate.severity])
            gate = { ...gate, severity: demote, demoted_by: 'mode' };
        const cwd = ctx.worktree ?? process.cwd();
        out.push(await evaluate(gate, () => runShellGate(custom.command, cwd)));
    }
    return out;
}
export function transitionAllowed(gates) {
    const blocking = gates.filter((g) => g.severity === 'block' && g.status === 'fail');
    const warnings = gates.filter((g) => g.severity === 'warn' && g.status === 'fail');
    return { ok: blocking.length === 0, blocking, warnings };
}
