import type { HarnessConfig } from './config/schema.js';
import type { Severity } from './contracts/header.js';
import { SEVERITY_RANK, allGates } from './registry/gates.js';
import type { StageName } from './store/state.js';

export interface ModeDef {
  name: string;
  extends: string | null;
  demote: Record<string, Severity>;
  merge_dispatches: boolean;
  verify_after_publish: boolean;
  skip_stages: StageName[];
  banner: string | null;
}

export class UnknownModeError extends Error {
  constructor(public readonly mode: string) {
    super(`unknown mode "${mode}"`);
    this.name = 'UnknownModeError';
  }
}

export const SKETCH_BANNER = 'Nothing reviewed this diff: sketch mode skipped review and verify.';

/** Built-in run modes: thorough runs everything; sketch runs scope through build only. */
export const BUILT_IN_MODES: Record<'thorough' | 'sketch', ModeDef> = {
  thorough: {
    name: 'thorough', extends: null, demote: {}, merge_dispatches: false, verify_after_publish: false, skip_stages: [], banner: null,
  },
  sketch: {
    name: 'sketch',
    extends: 'thorough',
    demote: { review_verdict_ship: 'off', ledger_reverified: 'off', walkthrough_done: 'off' },
    merge_dispatches: false,
    verify_after_publish: false,
    // 'challenge' is listed until the stage collapse removes that stage.
    skip_stages: ['review', 'challenge', 'verify'],
    banner: SKETCH_BANNER,
  },
};

function isBuiltIn(name: string): name is keyof typeof BUILT_IN_MODES {
  return Object.hasOwn(BUILT_IN_MODES, name);
}

/**
 * Resolve a mode by name: built-ins first, layered with any `config.modes`
 * entry of the same name; custom modes extend their parent (default thorough).
 */
export function resolveMode(name: string, config: HarnessConfig, seen: string[] = []): ModeDef {
  if (seen.includes(name)) throw new Error(`mode inheritance cycle: ${[...seen, name].join(' -> ')}`);
  const custom = config.modes?.[name];
  const builtIn = isBuiltIn(name) ? BUILT_IN_MODES[name] : null;
  if (!custom && !builtIn) throw new UnknownModeError(name);

  let base: ModeDef;
  if (builtIn) {
    base = { ...builtIn, demote: { ...builtIn.demote }, skip_stages: [...builtIn.skip_stages] };
  } else {
    const parentName = custom?.extends ?? 'thorough';
    const parent = resolveMode(parentName, config, [...seen, name]);
    base = { ...parent, name, extends: parentName, demote: { ...parent.demote }, skip_stages: [...parent.skip_stages] };
  }
  if (!custom) return base;
  return {
    ...base,
    demote: { ...base.demote, ...(custom.demote ?? {}) },
    merge_dispatches: custom.merge_dispatches ?? base.merge_dispatches,
    verify_after_publish: custom.verify_after_publish ?? base.verify_after_publish,
  };
}

/**
 * The demotions a mode declares, sorted by gate id. An entry that would raise
 * a gate above its registered default is a promotion, not a demotion, and is
 * dropped; an entry at the gate's default rank is kept because the mode still
 * declares it and the PR body lists every declared demotion.
 */
export function demotionsOf(mode: ModeDef): Array<{ gate: string; to: Severity }> {
  const defaults = new Map(allGates().map((g) => [g.id, g.severity]));
  return Object.entries(mode.demote)
    .filter(([gate, to]) => {
      if (to === 'block') return false;
      const def = defaults.get(gate);
      return def === undefined || SEVERITY_RANK[to] <= SEVERITY_RANK[def];
    })
    .map(([gate, to]) => ({ gate, to }))
    .sort((a, b) => a.gate.localeCompare(b.gate));
}
