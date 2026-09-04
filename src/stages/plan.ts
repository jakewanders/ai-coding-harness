import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'plan',
  purpose: 'Turn the acceptance criteria into an ordered implementation plan with files, interfaces, and the checks that will prove each criterion.',
  seats: ['docs'],
  outputs: ['plan.md'],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
