import { stageBrief } from './_shared.js';
export const info = {
    name: 'challenge',
    purpose: "Fresh-eyes adversarial pass over the whole unit once per unit; sticky once passed.",
    seats: ['counterweight'],
    outputs: ["review verdict for the challenge cycle", "challenge_passed flag"],
    sections: ['requirement', 'review'],
    calls: (id) => [
        `vcs diff { "id": "${id}" }`,
        `evidence record { "id": "${id}", "kind": "review_column", "payload": { "column": "adversarial", "findings": [] } }`,
        `evidence gates { "id": "${id}" }`,
    ],
};
export const render = (ctx) => stageBrief(info, ctx);
