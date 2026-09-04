import { stageBrief } from './_shared.js';
export const info = {
    name: 'close',
    purpose: 'Archive the unit: clean up the worktree, update the ledger, write the digest, and mark the ticket per the status hint.',
    seats: ['tracker'],
    outputs: ['digest entry', 'ledger update', 'worktree removed'],
};
export const render = (ctx) => stageBrief(info, ctx);
