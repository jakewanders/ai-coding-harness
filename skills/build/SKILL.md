---
name: build
description: "Plan against the criteria, implement test-first in the worktree, record the self-critique and personal-data audit, and commit through the gates."
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

If the header mode is `sketch`, also read @root/skills/build/modes/sketch.md. Other modes need
no extra reading.

## Procedure

1. Ensure the unit has an isolated worktree or branch; never work on a protected branch.
2. Write `plan.md` in the unit directory: `## Steps` (ordered), `## Tests` (criterion → test), `## Risks`, `## Deferred` (proposed follow-ups outside the criteria).
3. For a bug: write the failing test first and record `defect_repro` with the red output before touching the fix.
4. Implement step by step, running the check command through `exec run` after each step. Stay inside the criteria; anything extra goes to `## Deferred`.
5. Read your own diff as a reviewer and record `self_critique` (an empty list is valid). Audit added lines for personal data flowing to logs, storage, analytics or error bodies and record `pii` (empty findings means clean) or a `waiver`.
6. Commit only through `vcs commit`; it refuses while a gate fails and moves the unit to review when it succeeds.

## Calls

```harness
vcs worktree { "id": "<id>" }
exec run { "id": "<id>", "name": "check" }
evidence record { "id": "<id>", "kind": "defect_repro", "payload": { "test_location": "<file>", "command": "<cmd>", "red_output": "<verbatim>" } }
evidence record { "id": "<id>", "kind": "self_critique", "payload": { "findings": [] } }
evidence record { "id": "<id>", "kind": "pii", "payload": { "findings": [] } }
evidence gates { "id": "<id>" }
vcs commit { "id": "<id>", "message": "<id>: <what changed>" }
```

## Done when

`vcs commit` reports a sha and the unit is at review.
