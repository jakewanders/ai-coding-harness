import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'review',
  purpose: 'Review the diff column by column against the criteria and record each column as evidence for this cycle.',
  seats: ['counterweight', 'docs'],
  outputs: ['review_column evidence per column', 'reviews/cycle-<n>.json'],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
