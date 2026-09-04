import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'close',
  purpose: 'Archive the unit: clean up the worktree, update the ledger, write the digest, and mark the ticket per the status hint.',
  seats: ['tracker'],
  outputs: ['digest entry', 'ledger update', 'worktree removed'],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
