import { stageBrief } from './_shared.js';
export const info = {
    name: 'define',
    purpose: "Research the requirement: pin the source, normalize it into numbered acceptance criteria, and record related items before any code is touched.",
    roles: ['tracker', 'docs', 'design'],
    outputs: ["requirement.md with acceptance criteria AC-1\u2026", "related.md", "pinned source.md"],
    sections: ['requirement', 'decisions', 'ledger'],
    calls: (id) => [
        `spec pin { "id": "${id}", "text": "<verbatim source>", "ref": "<ticket key or url>" }`,
        `spec record { "id": "${id}", "title": "<title>", "body": "<normalized requirement>", "url": "<tracker url>" }`,
        `spec criteria { "id": "${id}", "set": ["<AC-1 text>", "<AC-2 text>"] }`,
        `spec related { "id": "${id}", "items": [{ "kind": "parent", "ref": "<key>", "title": "<title>" }] }`,
    ],
};
export const render = (ctx) => stageBrief(info, ctx);
