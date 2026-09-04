import { EVIDENCE_KINDS } from '../evidence/kinds.js';
import { defineGate, registerGate } from '../registry/gates.js';
import { recordsThisCycle } from './_shared.js';
export const counterweightConsulted = registerGate(defineGate({
    id: 'counterweight_consulted',
    stage: 'review',
    description: 'The second-opinion model was consulted this cycle (a counterweight record exists).',
    severity: 'warn',
    requires: 'seat:counterweight',
    check: (ctx) => (recordsThisCycle(ctx, 'counterweight').length ? { pass: true } : { pass: false, remedy: `${EVIDENCE_KINDS.counterweight.remedy}; consult the counterweight seat and record its findings` }),
}));
