import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'build',
  purpose: 'Implement the plan in the unit worktree, test first, keeping the check command green and recording runs as evidence.',
  seats: [],
  outputs: ['code changes in the worktree', 'run logs under runs/'],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
