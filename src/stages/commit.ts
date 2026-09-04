import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'commit',
  purpose: 'Record the self-critique, prove any defect reproduction, run the personal-data audit, and commit with a message that names the unit.',
  seats: [],
  outputs: ['self_critique evidence', 'pii evidence', 'commits.json entry'],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
