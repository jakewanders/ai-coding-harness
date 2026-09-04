import { stageBrief } from './_shared.js';
export const info = {
    name: 'verify',
    purpose: 'Validate the change in a browser against the acceptance criteria when the repo declares browser_ui.',
    seats: [],
    outputs: ['browser_findings evidence', 'walkthrough record'],
};
export const render = (ctx) => stageBrief(info, ctx);
