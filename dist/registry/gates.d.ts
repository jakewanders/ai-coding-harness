import type { HarnessConfig } from '../config/schema.js';
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
export declare const SEVERITY_RANK: Record<Severity, number>;
export declare function defineGate(def: GateDef): GateDef;
/** Add a gate to the registry; the gate modules call this at import time. */
export declare function registerGate(def: GateDef): GateDef;
export declare function allGates(): GateDef[];
export declare const CUSTOM_GATE_TIMEOUT_MS = 60000;
/** Does the unit's repo profile declare `capability` truthy? */
export declare function hasCapability(config: HarnessConfig, repo: string, capability: string): boolean;
/** Is the seat wired (tool names, or cli/http for counterweight)? */
export declare function hasSeat(config: HarnessConfig, seat: string): boolean;
/** A gate requirement: a repo capability, or `seat:<name>` for a wired seat. */
export declare function requirementMet(config: HarnessConfig, repo: string, requires: string): boolean;
/**
 * Resolve the gates guarding `stage`: apply `requires`, config overrides,
 * mode demotions (downward only), append custom shell gates, then run checks.
 */
export declare function resolveGates(stage: StageName, ctx: GateContext, mode: ModeDef, gates?: GateDef[]): Promise<ResolvedGate[]>;
export declare function transitionAllowed(gates: ResolvedGate[]): {
    ok: boolean;
    blocking: ResolvedGate[];
    warnings: ResolvedGate[];
};
