---
name: review
description: "Review the diff column by column against the criteria and record each column as evidence for this cycle."
stage: review
---

# review

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Everything below assumes you have read its header and stage material.

```harness
unit brief { "id": "<id>", "stage": "review" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

If the header mode is `sketch`, also read @root/skills/review/modes/sketch.md. Other modes need
no extra reading.

## Procedure

1. Fetch and read the diff against the remote base. Read the criteria and the latest review from the brief.
2. Record one `review_column` per column: `criteria_forward` (every criterion has proof), `criteria_reverse` (every hunk traces to a criterion), `architecture`, `security`, `tests`, `performance`; add `component_library` and `accessibility` only when the brief's capabilities declare them.
3. Record `impact` (changed paths and their consumers) and `reach_audit` (new surfaces and whether each subject list was extended).
4. Consult the counterweight seat when wired and record its findings; when unwired, say so.
5. Synthesize the columns into a verdict for this cycle.

## Calls

```harness
vcs diff { "id": "<id>" }
evidence record { "id": "<id>", "kind": "review_column", "payload": { "column": "criteria_forward", "findings": [] } }
evidence record { "id": "<id>", "kind": "impact", "payload": { "changed": [], "summary": "<one line>" } }
evidence record { "id": "<id>", "kind": "reach_audit", "payload": { "surfaces": [] } }
evidence list { "id": "<id>", "kind": "review_column" }
```

## Done when

Every applicable column is recorded for this cycle and the verdict is written; then `unit advance` (to revise on findings, otherwise onward).
