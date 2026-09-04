import type { EvidenceKind } from '../evidence/kinds.js';
import type { GateContext } from '../registry/gates.js';
import type { EvidenceRecord } from '../store/state.js';
/** Evidence records of `kind` recorded in the unit's current cycle. */
export declare function recordsThisCycle(ctx: GateContext, kind: EvidenceKind): EvidenceRecord[];
/** Is there a waiver for `gate` (any cycle; waivers travel with the unit)? */
export declare function waived(ctx: GateContext, gate: string): boolean;
