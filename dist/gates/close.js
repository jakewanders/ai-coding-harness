import { defineGate, registerGate } from '../registry/gates.js';
export const prRecorded = registerGate(defineGate({
    id: 'pr_recorded',
    stage: 'close',
    description: 'The pull request is recorded on the unit (pullreq record).',
    severity: 'block',
    check: (ctx) => (ctx.state.pr ? { pass: true } : { pass: false, remedy: 'record the pull request with pullreq record { id, url, base, head } before closing' }),
}));
