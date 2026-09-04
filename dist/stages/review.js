import { stageBrief } from './_shared.js';
export const info = {
    name: 'review',
    purpose: 'Review the diff against the criteria column by column, run the diff-audit rules and the ledger recheck, make the fresh-eyes adversarial pass, and synthesize one verdict for this cycle.',
    seats: ['docs'],
    outputs: ['review_column evidence per column', 'reviews/cycle-<n>.json with the verdict'],
    sections: ['requirement', 'plan', 'review', 'ledger'],
    calls: (id) => [
        `vcs diff { "id": "${id}" }`,
        `evidence record { "id": "${id}", "kind": "review_column", "payload": { "column": "criteria_forward", "findings": [] } }`,
        `evidence record { "id": "${id}", "kind": "review_column", "payload": { "column": "criteria_reverse", "findings": [] } }`,
        `evidence record { "id": "${id}", "kind": "review_column", "payload": { "column": "adversarial", "findings": [] } }`,
        `diffaudit run { "id": "${id}" }`,
        `ledger recheck { "entry": "L-1", "id": "${id}" }`,
        `evidence synthesize { "id": "${id}" }`,
        `unit report { "id": "${id}", "stage": "review", "outcome": "done", "summary": "<verdict and top findings>", "verdict": "ship" }`,
    ],
};
export const render = (ctx) => stageBrief(info, ctx, [
    '## Procedure',
    '',
    '1. Record criteria_forward (every criterion has proof) and criteria_reverse (every hunk traces to a criterion); add browser when the capabilities declare browser_ui.',
    '2. Run diffaudit run and recheck every open ledger entry against this diff.',
    '3. Adversarial pass: assume every earlier reader was wrong. Re-read the requirement, then the whole diff, and hunt for unmet criteria, untested branches, silent failure paths and data exposure. Record it as the adversarial column; an empty list is a valid, honest result.',
    '4. Synthesize, then report the verdict. Findings route the unit back to build; the cycle increments when review starts again.',
]);
