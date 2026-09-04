import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'verify',
  purpose: 'Validate the change in a browser against the acceptance criteria when the repo declares browser_ui.',
  seats: [],
  outputs: ['browser_findings evidence', 'walkthrough record'],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
