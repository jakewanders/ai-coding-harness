import type { BriefRenderer } from '../registry/stages.js';
import { stageBrief, type StageInfo } from './_shared.js';

export const info: StageInfo = {
  name: 'build',
  purpose: "Implement the plan in the unit worktree, test first, keeping the check command green and recording runs as evidence.",
  seats: [],
  outputs: ["code changes in the worktree", "run logs under runs/"],
  sections: ['requirement', 'plan', 'commands'],
  calls: (id) => [
    `vcs worktree { "id": "${id}" }`,
    `exec run { "id": "${id}", "name": "check" }`,
    `evidence record { "id": "${id}", "kind": "defect_repro", "payload": { "test_location": "<file>", "command": "<cmd>", "red_output": "<verbatim>" } }`,
  ],
};

export const render: BriefRenderer = (ctx) => stageBrief(info, ctx);
