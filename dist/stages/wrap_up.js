import { stageBrief } from './_shared.js';
export const info = {
    name: 'wrap_up',
    purpose: "Archive the unit: clean up the worktree, update the ledger, write the digest, and mark the ticket per the status hint.",
    seats: ['tracker'],
    outputs: ["digest entry", "ledger update", "worktree removed"],
    sections: ['requirement'],
    calls: (id) => [
        `digest write { "id": "${id}", "summary": "<one paragraph>", "decisions": ["<decision>"], "tags": ["<tag>"] }`,
        `digest wrapup { "id": "${id}" }`,
        `vcs cleanup { "id": "${id}" }`,
    ],
};
export const render = (ctx) => stageBrief(info, ctx);
