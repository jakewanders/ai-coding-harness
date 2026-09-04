# Master prompt — harness autonomous build

You are building `harness` inside this repository, one plan task per iteration, until the
whole of `docs/BUILD_PLAN.md` is done. The design is already approved. Do not brainstorm,
do not re-plan, do not ask the user questions. Skip any brainstorming or planning skill
your harness suggests; the only disciplines that apply are test-driven development and
verification before completion.

## Sources of truth, in precedence order

1. `docs/blueprint.md` — behavior. Read-only. Never edit it.
2. `docs/superpowers/specs/2026-09-04-harness-design.md` — names, layouts, contracts.
   Edit only to fix a contradiction with the blueprint, and log the fix.
3. `docs/BUILD_PLAN.md` — the task list you execute. You may split a task or correct an
   interface name here; you may never delete a requirement from it.

## Hard rules

- Clean room. Never open, search, list, or copy from `../dev-mcp-2`,
  `../dev-mcp-orchestrator`, or `../dev-workflow-packs`, or any other sibling directory.
  Everything you need is in `docs/`.
- Never run `git push`. Never create a remote repository. Never add a remote.
- Never weaken, skip, delete, or `.skip` a test to get green. Fix the code or the test's
  wrong expectation, and say which in the commit message.
- Tests are hermetic: no network, temp vault and fixture config via `HARNESS_VAULT` and
  `HARNESS_CONFIG`, never the real home directory, never dependent on the cwd being a git
  checkout.
- Runtime dependencies are exactly `@modelcontextprotocol/sdk`, `zod`, `yaml`. Anything
  else needs a justification line in `docs/BUILD_LOG.md` before you install it.
- Rebuild `dist/` and commit it with every change under `src/` or `hooks/`.
- Never print the completion promise unless the completion condition below is literally true.

## One iteration

1. Read `docs/BUILD_PLAN.md`. Find the first task whose checkbox is `- [ ]`. If none is
   open, go to **Completion**.
2. Read that task in full, plus the **Global Constraints** and **Shared interfaces**
   sections, plus the spec sections the task cites. Read only the blueprint sections the
   task cites. Do not re-read the whole plan or blueprint.
3. Look at `git log --oneline -5` and `docs/BUILD_LOG.md` tail to see what the last
   iteration left behind. If the working tree is dirty, finish or discard that work first
   and note it in the log.
4. Write the failing tests listed under **Tests must assert**. Run only those tests and
   confirm they fail for the expected reason.
5. Implement the minimum that satisfies **Interfaces**. Match the names and signatures in
   **Shared interfaces** exactly; later tasks depend on them.
6. Run, in order, and fix until every one passes:
   ```bash
   npm run typecheck && npm test && npm run build
   ```
   From Task 9 on, also `npm run gen:tools`. From Task 35 on, also `npm run check:dist`.
7. Do a short self-review of the diff: does every **Tests must assert** bullet have a
   test, does anything reference a name that no task defines, did any vendor or sibling
   vocabulary slip in? Fix what you find.
8. Commit everything with the message `step NN: <task title>` and, if you changed a test's
   expectation or the plan, one line saying what and why.
9. In `docs/BUILD_PLAN.md` change that task's `- [ ] Task NN` to `- [x] Task NN`.
   Append one line to `docs/BUILD_LOG.md`:
   `NN · <title> · tests <total passing> · <one sentence on anything notable>`.
   Commit these two files as `log: step NN`.
10. End your turn with a one-line status. Do not start the next task in the same turn.

## When a task is too big

If after a real attempt the task cannot reach green in one iteration, split it: replace its
checkbox line with two or more sub-task lines (`- [ ] Task NNa …`, `- [ ] Task NNb …`),
each with its own files, interfaces, and test assertions carved from the original. Commit
the split as `plan: split step NN`, tick nothing, end the turn. Splitting is normal.
Half-finishing and ticking is forbidden.

## When a task is blocked

Blocked means a hard external fact prevents completion (a dependency API missing on this
Node version, a contradiction between blueprint and spec you cannot resolve). Retry once
with a different approach. If still blocked, mark the line `- [!] Task NN`, add an entry
to `docs/BLOCKERS.md` with the task number, what you tried, the exact error, and a suggested
path, commit as `blocked: step NN`, and continue to the next open task. A `[!]` task is
revisited by Task 37 and by any later iteration where no `[ ]` remains.

## Completion

The completion condition is: `docs/BUILD_PLAN.md` contains no `- [ ]` line, every `[!]`
line has a matching entry in `docs/BLOCKERS.md` and has been retried at least once more,
Task 37's checklist has been run with its output pasted into `docs/BUILD_LOG.md`, and the
working tree is clean. Verify each of those by running commands, not from memory. Only when
all of them are true, end your turn with a short summary followed by the exact final line:

<promise>HARNESS BUILD COMPLETE</promise>
