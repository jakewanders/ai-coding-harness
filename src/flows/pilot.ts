import { resolveMode, UnknownModeError } from '../modes.js';
import { CORE_ORDER, registerRenderer, type BriefRenderer } from '../registry/stages.js';

export const render: BriefRenderer = (ctx) => {
  const id = ctx.state?.id ?? '<id>';
  const stage = ctx.state?.stage ?? 'scope';
  let merged = false;
  try {
    merged = resolveMode(ctx.header.mode, ctx.config.config).merge_dispatches;
  } catch (e) {
    if (!(e instanceof UnknownModeError)) throw e;
  }
  const lines = [
    '# pilot',
    '',
    'You are the conductor. You never do stage work yourself: one fresh subagent per stage, routed by the engine.',
    `Unit: ${id}${ctx.state ? ` (currently at ${stage}, cycle ${ctx.state.cycle}, mode ${ctx.state.mode})` : ' (start one first with unit start)'}.`,
    '',
    '## Loop',
    '',
    '1. Ask the engine what to do next.',
    '',
    '```harness',
    `unit route { "id": "${id}" }`,
    '```',
    '',
    '2. On `decision: proceed` or `retry`, dispatch one subagent for `next` with the template below. On `blocked`, show the questions to the user, store the answers, then route again. On `done`, render the wrap-up.',
    '',
    '```harness',
    `unit answer { "id": "${id}", "answers": { "<question>": "<answer>" } }`,
    `digest wrapup { "id": "${id}" }`,
    '```',
    '',
    '3. If this is a resumed session, reconcile first and surface every disagreement before dispatching anything.',
    '',
    '```harness',
    `unit reconcile { "id": "${id}", "live": { "branch": "<current branch>", "uncommitted": false, "pr_state": "none" } }`,
    '```',
    '',
    '## Dispatch template',
    '',
    'Send the subagent exactly this, with `<stage>` filled in:',
    '',
    '> Read `@root/skills/<stage>/SKILL.md` (root is in the brief header). First call `unit brief` with',
    `> \`{ "id": "${id}", "stage": "<stage>", "quiet": true }\`. Follow every step of the skill and`,
    '> `@root/skills/_shared/standing-rules.md`. Do not advance the unit. Finish by calling `unit report` with',
    '> your outcome (done, blocked or failed), a one-paragraph summary, any questions for the human, the review',
    '> verdict when the stage produces one, and the artifacts you wrote.',
    '',
    '```harness',
    `unit brief { "id": "${id}", "stage": "<stage>", "quiet": true }`,
    `unit report { "id": "${id}", "stage": "<stage>", "outcome": "done", "summary": "<paragraph>", "questions": [], "artifacts": {} }`,
    '```',
    '',
    `Stage skills: ${CORE_ORDER.map((s) => `@root/skills/${s}/SKILL.md`).join(', ')}.`,
    '',
    '## Checkpoint rules',
    '',
    '- Blocked questions go to the user verbatim; persist their answers with `unit answer` before routing again.',
    '- A commit failure is retried by the engine at most twice, then it becomes a checkpoint for the user.',
    '- Check every report against the standing rules (scope, cross-check, remote refs, no posting without approval); re-dispatch the stage on a breach.',
    '- Never post to a tracker, code host or chat yourself; subagents draft, the user approves.',
    '- After publish, if the reviewbot seat is wired, run at most two rounds of the review-bot loop.',
    '',
    '## Review-bot loop',
    '',
    `Only when the reviewbot seat is wired (${ctx.header.seats.reviewbot === 'unwired' ? 'it is unwired here: skip this section and say so' : 'it is wired here'}). After the publish report:`,
    '',
    '1. `reviewbot ready` records round 0 and names the codehost call that marks the PR ready.',
    '2. Poll the bot at most 10 times, 30 s apart, recording each result with `reviewbot poll`.',
    '3. On changes_requested: `reviewbot threads` stores the bot threads, `unit route` returns the respond flow, you dispatch it (one batched commit, threads resolved on the host), then `reviewbot round` counts the round.',
    '4. After two rounds, or on passed/failed, `unit route` goes to close; remaining bot findings are deferred to the human.',
    '',
    '```harness',
    `reviewbot ready { "id": "${id}" }`,
    `reviewbot poll { "id": "${id}", "status": "pending", "polls": 1 }`,
    `reviewbot threads { "id": "${id}", "threads": [] }`,
    `reviewbot round { "id": "${id}" }`,
    '```',
  ];
  if (merged) {
    lines.push('', '## Merged dispatch', '', `Mode ${ctx.header.mode} merges the specialist review columns into one dispatch: send a single review subagent that records every required column itself instead of one subagent per column.`);
  }
  return lines.join('\n');
};

registerRenderer('pilot', render);
