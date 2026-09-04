import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'revise',
  purpose: "Address the review findings, one class at a time, and return to commit for a fresh cycle.",
  seats: [],
  outputs: ["code changes addressing findings", "ledger entries for deferred items"],
  sections: ['requirement', 'review', 'commands'],
  calls: (id) => [
    `evidence list { "id": "${id}", "kind": "review_column" }`,
    `exec run { "id": "${id}", "name": "check" }`,
    `unit advance { "id": "${id}", "to": "commit" }`,
  ],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
