import { spawnSync } from 'node:child_process';
import { roleWiring } from '../brief/roles.js';
import type { HarnessConfig } from '../config/schema.js';
import { ROLE_NAMES, type RoleName } from '../contracts/header.js';
import type { Severity } from '../contracts/header.js';
import type { ModeDef } from '../modes.js';
import type { StageName, UnitState } from '../store/state.js';

export type { Severity } from '../contracts/header.js';

export interface GateContext {
  state: UnitState;
  config: HarnessConfig;
  unitDir: string;
  worktree: string | null;
  /** Checkout the tool was invoked from; used when the unit has no worktree. */
  cwd?: string;
  /** Vault root, for gates that read repo-level records such as the ledger. */
  vault?: string;
}

export interface GateOutcome {
  pass: boolean;
  remedy?: string;
  /** False when the gate does not apply to this unit (resolves to n/a). */
  applicable?: boolean;
}

export interface GateDef {
  id: string;
  stage: StageName;
  description: string;
  severity: Severity;
  requires?: string;
  check: (ctx: GateContext) => GateOutcome | Promise<GateOutcome>;
}

export interface ResolvedGate {
  id: string;
  severity: Severity;
  status: 'pass' | 'fail' | 'n/a';
  remedy?: string;
  demoted_by?: 'config' | 'mode' | 'kit';
  /** A mode tried to raise this gate's severity; modes may only demote. */
  ignored_promotion?: Severity;
}

export const SEVERITY_RANK: Record<Severity, number> = { block: 2, warn: 1, off: 0 };

export function defineGate(def: GateDef): GateDef {
  return def;
}

const registry: GateDef[] = [];

/** Add a gate to the registry; the gate modules call this at import time. */
export function registerGate(def: GateDef): GateDef {
  if (!registry.some((g) => g.id === def.id)) registry.push(def);
  return def;
}

export function allGates(): GateDef[] {
  return [...registry];
}

export const CUSTOM_GATE_TIMEOUT_MS = 60_000;

/** Does the unit's repo profile declare `capability` truthy? */
export function hasCapability(config: HarnessConfig, repo: string, capability: string): boolean {
  const caps = config.repos?.[repo]?.capabilities as Record<string, unknown> | undefined;
  return Boolean(caps?.[capability]);
}

/** Is the role wired with at least one tool name? */
export function hasRole(config: HarnessConfig, role: string): boolean {
  if (!(ROLE_NAMES as readonly string[]).includes(role)) return false;
  return roleWiring(config)[role as RoleName] !== 'unwired';
}

/** A gate requirement: a repo capability, or `role:<name>` for a wired role. */
export function requirementMet(config: HarnessConfig, repo: string, requires: string): boolean {
  return requires.startsWith('role:') ? hasRole(config, requires.slice('role:'.length)) : hasCapability(config, repo, requires);
}

function runShellGate(command: string, cwd: string): GateOutcome {
  const r = spawnSync('sh', ['-c', command], {
    cwd,
    encoding: 'utf8',
    timeout: CUSTOM_GATE_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.error) return { pass: false, remedy: r.error.message };
  if (r.status === 0) return { pass: true };
  const detail = (r.stderr || r.stdout || '').trim();
  return { pass: false, remedy: detail ? `command failed (exit ${r.status}): ${detail}` : `command failed (exit ${r.status})` };
}

async function evaluate(gate: ResolvedGate, check: () => GateOutcome | Promise<GateOutcome>): Promise<ResolvedGate> {
  if (gate.severity === 'off') return { ...gate, status: 'n/a' };
  try {
    const outcome = await check();
    if (outcome.applicable === false) return { ...gate, status: 'n/a' };
    return outcome.pass ? { ...gate, status: 'pass' } : { ...gate, status: 'fail', ...(outcome.remedy ? { remedy: outcome.remedy } : {}) };
  } catch (e) {
    return { ...gate, status: 'fail', remedy: `gate check threw: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Resolve the gates guarding `stage`: apply `requires`, config overrides,
 * mode demotions (downward only), append custom shell gates, then run checks.
 */
export async function resolveGates(stage: StageName, ctx: GateContext, mode: ModeDef, gates: GateDef[] = allGates()): Promise<ResolvedGate[]> {
  const out: ResolvedGate[] = [];

  for (const def of gates.filter((g) => g.stage === stage)) {
    const override = ctx.config.gates?.[def.id];
    const requires = override && 'requires' in override ? override.requires : def.requires;
    let gate: ResolvedGate = { id: def.id, severity: def.severity, status: 'n/a' };

    if (override?.severity && override.severity !== gate.severity) {
      gate = { ...gate, severity: override.severity, demoted_by: 'config' };
    }
    const demote = mode.demote[def.id];
    if (demote) {
      if (SEVERITY_RANK[demote] < SEVERITY_RANK[gate.severity]) gate = { ...gate, severity: demote, demoted_by: 'mode' };
      else if (SEVERITY_RANK[demote] > SEVERITY_RANK[gate.severity]) gate = { ...gate, ignored_promotion: demote };
    }
    if (requires && !requirementMet(ctx.config, ctx.state.repo, requires)) {
      out.push({ ...gate, status: 'n/a' });
      continue;
    }
    out.push(await evaluate(gate, () => def.check(ctx)));
  }

  for (const custom of (ctx.config.custom_gates ?? []).filter((g) => g.stage === stage)) {
    let gate: ResolvedGate = { id: custom.id, severity: custom.severity ?? 'warn', status: 'n/a' };
    const demote = mode.demote[custom.id];
    if (demote && SEVERITY_RANK[demote] < SEVERITY_RANK[gate.severity]) gate = { ...gate, severity: demote, demoted_by: 'mode' };
    const cwd = ctx.worktree ?? process.cwd();
    out.push(await evaluate(gate, () => runShellGate(custom.command, cwd)));
  }

  return out;
}

export function transitionAllowed(gates: ResolvedGate[]): { ok: boolean; blocking: ResolvedGate[]; warnings: ResolvedGate[] } {
  const blocking = gates.filter((g) => g.severity === 'block' && g.status === 'fail');
  const warnings = gates.filter((g) => g.severity === 'warn' && g.status === 'fail');
  return { ok: blocking.length === 0, blocking, warnings };
}
