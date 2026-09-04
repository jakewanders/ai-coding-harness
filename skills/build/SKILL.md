---
name: build
description: "Implement the plan in the unit worktree, test first, keeping the check command green and recording runs as evidence."
stage: build
---

# build

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Everything below assumes you have read its header and stage material.

```harness
unit brief { "id": "<id>", "stage": "build" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

## Procedure

1. Ensure the unit has an isolated worktree or branch; never work on a protected branch.
2. For a bug: write the failing test first and record the red output as `defect_repro` before touching the fix.
3. Work through `plan.md` step by step. Run the project's check or test command through `exec run` after each step so the result is recorded.
4. Stay inside the criteria. Anything extra goes to `## Deferred` in `plan.md`.
5. Finish with the check command green in this cycle.

## Calls

```harness
vcs worktree { "id": "<id>" }
exec run { "id": "<id>", "name": "check" }
evidence record { "id": "<id>", "kind": "defect_repro", "payload": { "test_location": "<file>", "command": "<cmd>", "red_output": "<verbatim>" } }
vcs diff { "id": "<id>", "stat": true }
```

## Done when

The latest check run exited 0 and every plan step is either done or deferred; then `unit advance`.
