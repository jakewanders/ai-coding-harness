import { stageBrief } from './_shared.js';
export const info = {
    name: 'review',
    purpose: "Review the diff column by column against the criteria and record each column as evidence for this cycle.",
    seats: ['counterweight', 'docs'],
    outputs: ["review_column evidence per column", "reviews/cycle-<n>.json"],
    sections: ['requirement', 'plan', 'review'],
    calls: (id) => [
        `vcs diff { "id": "${id}" }`,
        `evidence record { "id": "${id}", "kind": "review_column", "payload": { "column": "criteria_forward", "findings": [] } }`,
        `evidence record { "id": "${id}", "kind": "impact", "payload": { "changed": [], "summary": "<one line>" } }`,
        `evidence record { "id": "${id}", "kind": "reach_audit", "payload": { "surfaces": [] } }`,
    ],
};
export const render = (ctx) => stageBrief(info, ctx);
