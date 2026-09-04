import { stageBrief } from './_shared.js';
export const info = {
    name: 'build',
    purpose: 'Plan against the acceptance criteria, implement test-first in the unit worktree with the check command green, record the self-critique and personal-data audit, and commit through the gates.',
    seats: ['docs'],
    outputs: ['plan.md (Steps, Tests, Risks, Deferred)', 'code changes in the worktree', 'run logs under runs/', 'self_critique and pii evidence', 'commits.json entry'],
    sections: ['requirement', 'plan', 'commands', 'ledger'],
    calls: (id) => [
        `vcs worktree { "id": "${id}" }`,
        `exec run { "id": "${id}", "name": "check" }`,
        `evidence record { "id": "${id}", "kind": "defect_repro", "payload": { "test_location": "<file>", "command": "<cmd>", "red_output": "<verbatim>" } }`,
        `evidence record { "id": "${id}", "kind": "self_critique", "payload": { "findings": [] } }`,
        `evidence record { "id": "${id}", "kind": "pii", "payload": { "findings": [] } }`,
        `evidence gates { "id": "${id}" }`,
        `vcs commit { "id": "${id}", "message": "${id}: <what changed>" }`,
    ],
};
export const render = (ctx) => stageBrief(info, ctx, [
    '## Procedure',
    '',
    '1. Write plan.md in the unit directory: `## Steps` (ordered), `## Tests` (criterion → test), `## Risks`, `## Deferred` (follow-ups outside the criteria).',
    '2. For a bug, write the failing test first and record defect_repro with the red output before touching the fix.',
    '3. Implement step by step, running the check command through exec run after each step.',
    '4. Read your own diff as a reviewer and record self_critique (an empty list is valid); audit added lines for personal data and record pii.',
    '5. Commit only through vcs commit: it refuses while a gate fails and moves the unit to review when it succeeds.',
]);
