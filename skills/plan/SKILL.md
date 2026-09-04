---
name: plan
description: "Turn the acceptance criteria into an ordered implementation plan with files, interfaces and the checks that prove each criterion."
stage: plan
---

# plan

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Everything below assumes you have read its header and stage material.

```harness
unit brief { "id": "<id>", "stage": "plan" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

## Procedure

1. Read the requirement and criteria from the brief. Read the repo commands listed there; if none, propose them under `## Commands` in the plan.
2. For each criterion, decide which files change, which test proves it, and in what order the work lands.
3. Write `plan.md` in the unit directory with sections: `## Steps` (ordered), `## Tests` (criterion → test), `## Risks`, `## Deferred` (proposed follow-ups that are out of scope).
4. Keep the plan to what the criteria require; extras go under `## Deferred`.

## Calls

```harness
spec get { "id": "<id>" }
exec commands { "id": "<id>" }
recall search { "query": "<component or area names>" }
```

## Done when

`plan.md` exists with every criterion mapped to a test, and `unit advance` succeeds.
