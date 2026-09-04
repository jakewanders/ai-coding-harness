import { stageBrief } from './_shared.js';
export const info = {
    name: 'publish',
    purpose: 'Ghostwrite the PR body from the record, list every mode demotion, and open the pull request through the codehost seat.',
    seats: ['codehost', 'tracker', 'chat'],
    outputs: ['pullreq record', 'drafts/pr-body.md', 'tracker status hint applied'],
};
export const render = (ctx) => stageBrief(info, ctx);
