import { EVIDENCE_KINDS } from '../evidence/kinds.js';
import { defineGate, registerGate } from '../registry/gates.js';
import { recordsThisCycle } from './_shared.js';

export const impactRecorded = registerGate(defineGate({
  id: 'impact_recorded',
  stage: 'review',
  description: 'An impact record (changed paths and their consumers) exists for this cycle.',
  severity: 'warn',
  check: (ctx) => (recordsThisCycle(ctx, 'impact').length ? { pass: true } : { pass: false, remedy: `${EVIDENCE_KINDS.impact.remedy}; analyze impact computes it from the diff` }),
}));

interface ReachSurface { surface: string; subjects: unknown[]; waived?: boolean; reason?: string }

export const reachAuditRecorded = registerGate(defineGate({
  id: 'reach_audit_recorded',
  stage: 'review',
  description: 'A reach_audit record for this cycle where every new surface is covered by a subject list or explicitly waived with a reason.',
  severity: 'block',
  check: (ctx) => {
    const latest = recordsThisCycle(ctx, 'reach_audit').at(-1);
    if (!latest) return { pass: false, remedy: `${EVIDENCE_KINDS.reach_audit.remedy}; analyze reach computes it from the diff` };
    const surfaces = ((latest.payload as { surfaces?: ReachSurface[] })?.surfaces ?? []);
    const uncovered = surfaces.filter((s) => !(s.subjects?.length > 0) && !(s.waived === true && s.reason?.trim()));
    if (!uncovered.length) return { pass: true };
    return { pass: false, remedy: `uncovered surface(s): ${uncovered.map((s) => s.surface).join(', ')}; extend the e2e/mock/contract subject lists or set waived: true with a reason` };
  },
}));
