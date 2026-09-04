import { stageBrief } from './_shared.js';
export const info = {
    name: 'commit',
    purpose: "Record the self-critique, prove any defect reproduction, run the personal-data audit, and commit with a message that names the unit.",
    seats: [],
    outputs: ["self_critique evidence", "pii evidence", "commits.json entry"],
    sections: ['requirement', 'commands'],
    calls: (id) => [
        `vcs diff { "id": "${id}" }`,
        `evidence record { "id": "${id}", "kind": "self_critique", "payload": { "findings": [] } }`,
        `evidence record { "id": "${id}", "kind": "pii", "payload": { "findings": [] } }`,
        `evidence gates { "id": "${id}" }`,
        `vcs commit { "id": "${id}", "message": "${id}: <what changed>" }`,
    ],
};
export const render = (ctx) => stageBrief(info, ctx);
