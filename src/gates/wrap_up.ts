import { defineGate, registerGate } from '../registry/gates.js';
import { waived } from './_shared.js';

export const prRecorded = registerGate(defineGate({
  id: 'pr_recorded',
  stage: 'wrap_up',
  description: 'The pull request is recorded on the unit (pullreq record), or waived when the user chose not to open it. Checked when entering wrap_up, the terminal stage.',
  severity: 'block',
  check: (ctx) => (ctx.state.pr || waived(ctx, 'pr_recorded') ? { pass: true } : { pass: false, remedy: 'record the pull request with pullreq record { id, url, base, head } before wrapping up, or record a waiver for pr_recorded if the PR will not be opened' }),
}));
