---
name: revise
description: "Address the review findings one class at a time and return to commit for a fresh cycle."
stage: revise
---

# revise

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Everything below assumes you have read its header and stage material.

```harness
unit brief { "id": "<id>", "stage": "revise" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

## Procedure

1. Read the latest review in the brief. Group findings by class; fix blockers first, then majors.
2. Fix inside the criteria only. A finding that asks for out-of-scope work becomes a `## Deferred` entry, not code.
3. Run the check command through `exec run` after the fixes.
4. Return to commit: the next `vcs commit` starts a new review cycle.

## Calls

```harness
evidence list { "id": "<id>", "kind": "review_column" }
exec run { "id": "<id>", "name": "check" }
unit advance { "id": "<id>", "to": "commit" }
```

## Done when

Every blocker and major from the latest review is fixed or deferred with a rationale, and the unit is back at commit.
