import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'challenge',
  purpose: 'Fresh-eyes adversarial pass over the whole unit once per unit; sticky once passed.',
  seats: ['counterweight'],
  outputs: ['review verdict for the challenge cycle', 'challenge_passed flag'],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
