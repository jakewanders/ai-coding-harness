import { stageBrief } from './_shared.js';
export const info = {
    name: 'plan',
    purpose: "Turn the acceptance criteria into an ordered implementation plan with files, interfaces, and the checks that will prove each criterion.",
    seats: ['docs'],
    outputs: ["plan.md"],
    sections: ['requirement', 'commands', 'decisions'],
    calls: (id) => [
        `spec get { "id": "${id}" }`,
        `exec commands { "id": "${id}" }`,
    ],
};
export const render = (ctx) => stageBrief(info, ctx);
