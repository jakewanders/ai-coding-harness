import { stageBrief } from './_shared.js';
export const info = {
    name: 'review',
    purpose: 'Review the diff column by column against the criteria and record each column as evidence for this cycle.',
    seats: ['counterweight', 'docs'],
    outputs: ['review_column evidence per column', 'reviews/cycle-<n>.json'],
};
export const render = (ctx) => stageBrief(info, ctx);
