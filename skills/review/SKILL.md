---
name: review
description: "Review the diff column by column against the criteria, run the diff-audit rules and ledger recheck, make the adversarial pass, and synthesize one verdict."
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

1. Fetch and read the diff against the remote base. Read the criteria, the plan and the latest review from the brief.
2. Record `criteria_forward` (every criterion has proof), `criteria_reverse` (every hunk traces to a criterion), and `browser` when the capabilities declare browser_ui.
3. Run `diffaudit run`; recheck every open ledger entry with `ledger recheck`.
4. Adversarial pass: assume every earlier reader was wrong; re-read the requirement, then the whole diff, and hunt for unmet criteria, untested branches, silent failure paths and data exposure. Record it as the `adversarial` column; an empty list is a valid, honest result.
5. `evidence synthesize`, then `unit report` with the verdict. Findings route the unit back to build; the engine increments the cycle when review starts again.

## Calls

```harness
vcs diff { "id": "<id>" }
evidence record { "id": "<id>", "kind": "review_column", "payload": { "column": "criteria_forward", "findings": [] } }
evidence record { "id": "<id>", "kind": "review_column", "payload": { "column": "adversarial", "findings": [] } }
diffaudit run { "id": "<id>" }
ledger recheck { "entry": "L-1", "id": "<id>" }
evidence synthesize { "id": "<id>" }
unit report { "id": "<id>", "stage": "review", "outcome": "done", "summary": "<verdict and top findings>", "verdict": "ship" }
```

## Done when

Every required column is recorded for this cycle, the verdict is synthesized, and `unit report` carries it.
