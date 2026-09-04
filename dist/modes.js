import { SEVERITY_RANK, allGates } from './registry/gates.js';
export class UnknownModeError extends Error {
    mode;
    constructor(mode) {
        super(`unknown mode "${mode}"`);
        this.mode = mode;
        this.name = 'UnknownModeError';
    }
}
export const SKETCH_BANNER = 'Nothing reviewed this diff: sketch mode skipped review, challenge and verify.';
/** Built-in run modes per spec section 8. */
export const BUILT_IN_MODES = {
    thorough: {
        name: 'thorough', extends: null, demote: {}, merge_dispatches: false, verify_after_publish: false, skip_stages: [], banner: null,
    },
    express: {
        name: 'express',
        extends: 'thorough',
        demote: { reach_audit_recorded: 'warn', counterweight_consulted: 'warn' },
        merge_dispatches: true,
        verify_after_publish: true,
        skip_stages: [],
        banner: null,
    },
    sketch: {
        name: 'sketch',
        extends: 'thorough',
        demote: {
            impact_recorded: 'off', reach_audit_recorded: 'off', ledger_reverified: 'off', counterweight_consulted: 'off',
            review_verdict_ship: 'off', challenge_passed: 'off', walkthrough_done: 'off',
        },
        merge_dispatches: true,
        verify_after_publish: false,
        skip_stages: ['review', 'challenge', 'verify'],
        banner: SKETCH_BANNER,
    },
};
function isBuiltIn(name) {
    return Object.hasOwn(BUILT_IN_MODES, name);
}
/**
 * Resolve a mode by name: built-ins first, layered with any `config.modes`
 * entry of the same name; custom modes extend their parent (default thorough).
 */
export function resolveMode(name, config, seen = []) {
    if (seen.includes(name))
        throw new Error(`mode inheritance cycle: ${[...seen, name].join(' -> ')}`);
    const custom = config.modes?.[name];
    const builtIn = isBuiltIn(name) ? BUILT_IN_MODES[name] : null;
    if (!custom && !builtIn)
        throw new UnknownModeError(name);
    let base;
    if (builtIn) {
        base = { ...builtIn, demote: { ...builtIn.demote }, skip_stages: [...builtIn.skip_stages] };
    }
    else {
        const parentName = custom?.extends ?? 'thorough';
        const parent = resolveMode(parentName, config, [...seen, name]);
        base = { ...parent, name, extends: parentName, demote: { ...parent.demote }, skip_stages: [...parent.skip_stages] };
    }
    if (!custom)
        return base;
    return {
        ...base,
        demote: { ...base.demote, ...(custom.demote ?? {}) },
        merge_dispatches: custom.merge_dispatches ?? base.merge_dispatches,
        verify_after_publish: custom.verify_after_publish ?? base.verify_after_publish,
    };
}
/**
 * The demotions a mode really applies, sorted by gate id. An entry that would
 * raise a gate above its registered default is not a demotion and is dropped.
 */
export function demotionsOf(mode) {
    const defaults = new Map(allGates().map((g) => [g.id, g.severity]));
    return Object.entries(mode.demote)
        .filter(([gate, to]) => {
        if (to === 'block')
            return false;
        const def = defaults.get(gate);
        return def === undefined || SEVERITY_RANK[to] < SEVERITY_RANK[def];
    })
        .map(([gate, to]) => ({ gate, to }))
        .sort((a, b) => a.gate.localeCompare(b.gate));
}
