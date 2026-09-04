import { stageBrief } from './_shared.js';
export const info = {
    name: 'verify',
    purpose: "Validate the change in a browser against the acceptance criteria when the repo declares browser_ui.",
    seats: [],
    outputs: ["browser_findings evidence", "walkthrough record"],
    sections: ['requirement', 'commands'],
    calls: (id) => [
        `exec run { "id": "${id}", "name": "boot" }`,
        `evidence record { "id": "${id}", "kind": "browser_findings", "payload": { "environment": "<name>", "findings": [] } }`,
        `evidence record { "id": "${id}", "kind": "criteria_validation", "payload": { "results": [{ "criterion": "AC-1", "status": "proven", "proof": "<what you saw>" }] } }`,
    ],
};
export const render = (ctx) => stageBrief(info, ctx);
