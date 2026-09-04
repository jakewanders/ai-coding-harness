import { EVIDENCE_KINDS } from '../evidence/kinds.js';
import { defineGate, registerGate } from '../registry/gates.js';
import { recordsThisCycle } from './_shared.js';

interface CriterionResult { id: string; result: 'pass' | 'fail' | 'blocked' }

export const walkthroughDone = registerGate(defineGate({
  id: 'walkthrough_done',
  stage: 'publish',
  description: 'A browser_findings record for this cycle marks every acceptance criterion as pass.',
  severity: 'block',
  requires: 'browser_ui',
  check: (ctx) => {
    const latest = recordsThisCycle(ctx, 'browser_findings').at(-1);
    if (!latest) return { pass: false, remedy: `${EVIDENCE_KINDS.browser_findings.remedy}; run the verify stage` };
    const criteria = ((latest.payload as { criteria?: CriterionResult[] })?.criteria ?? []);
    if (!criteria.length) return { pass: false, remedy: 'browser_findings lists no criteria; exercise every acceptance criterion in the browser and record each result' };
    const notPassing = criteria.filter((c) => c.result !== 'pass');
    if (!notPassing.length) return { pass: true };
    return { pass: false, remedy: `criteria not passing in the browser: ${notPassing.map((c) => `${c.id} (${c.result})`).join(', ')}` };
  },
}));
