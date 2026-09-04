import type { EvidenceKind } from '../evidence/kinds.js';
import type { GateContext } from '../registry/gates.js';
import type { EvidenceRecord } from '../store/state.js';

/** Evidence records of `kind` recorded in the unit's current cycle. */
export function recordsThisCycle(ctx: GateContext, kind: EvidenceKind): EvidenceRecord[] {
  return ctx.state.evidence.filter((e) => e.kind === kind && e.cycle === ctx.state.cycle);
}

/** Is there a waiver for `gate` (any cycle; waivers travel with the unit)? */
export function waived(ctx: GateContext, gate: string): boolean {
  return ctx.state.evidence.some((e) => e.kind === 'waiver' && (e.payload as { gate?: string })?.gate === gate);
}
