import { stageBrief } from './_shared.js';
export const info = {
    name: 'pr',
    purpose: "Ghostwrite the PR body from the record, list every mode demotion, and open the pull request through the codehost seat.",
    seats: ['codehost', 'tracker', 'chat'],
    outputs: ["pullreq record", "drafts/pr-body.md", "tracker status hint applied"],
    sections: ['requirement', 'review'],
    calls: (id) => [
        `evidence record { "id": "${id}", "kind": "claims", "payload": { "claims": [] } }`,
        `pullreq body { "id": "${id}" }`,
        `pullreq record { "id": "${id}", "url": "<pr url>", "number": 0, "base": "<base>", "head": "<branch>" }`,
    ],
};
export const render = (ctx) => stageBrief(info, ctx);
