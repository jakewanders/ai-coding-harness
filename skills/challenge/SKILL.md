---
name: challenge
description: "Fresh-eyes adversarial pass over the whole unit, once per unit, sticky once passed."
stage: challenge
---

# challenge

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Everything below assumes you have read its header and stage material.

```harness
unit brief { "id": "<id>", "stage": "challenge" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

## Procedure

1. Assume every earlier reviewer was wrong. Re-read the requirement, then the full diff against the remote base, without reading prior findings first.
2. Hunt for what accepted findings missed: unmet criteria, untested branches, silent failure paths, data exposure.
3. Record the pass as a `review_column` with column `adversarial`; an empty findings list is a valid, honest result.
4. Consult the counterweight seat when wired.

## Calls

```harness
vcs diff { "id": "<id>" }
spec get { "id": "<id>" }
evidence record { "id": "<id>", "kind": "review_column", "payload": { "column": "adversarial", "findings": [] } }
evidence gates { "id": "<id>" }
```

## Done when

The adversarial column is recorded with no open blocker and `unit advance` succeeds; the pass is sticky for the unit.
