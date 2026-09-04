import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'review',
  purpose: "Review the diff column by column against the criteria and record each column as evidence for this cycle.",
  seats: ['counterweight', 'docs'],
  outputs: ["review_column evidence per column", "reviews/cycle-<n>.json"],
  sections: ['requirement', 'plan', 'review', 'ledger'],
  calls: (id) => [
    `vcs diff { "id": "${id}" }`,
    `evidence record { "id": "${id}", "kind": "review_column", "payload": { "column": "criteria_forward", "findings": [] } }`,
    `evidence record { "id": "${id}", "kind": "impact", "payload": { "changed": [], "summary": "<one line>" } }`,
    `evidence record { "id": "${id}", "kind": "reach_audit", "payload": { "surfaces": [] } }`,
  ],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
