import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'scope',
  purpose: 'Research the requirement: pin the source, normalize it into numbered acceptance criteria, and record related items before any code is touched.',
  seats: ['tracker', 'docs', 'design'],
  outputs: ['requirement.md with acceptance criteria AC-1…', 'related.md', 'pinned source.md'],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
