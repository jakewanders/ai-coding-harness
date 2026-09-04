---
name: commit
description: "Record the self-critique, prove any defect reproduction, run the personal-data audit, and commit with a message that names the unit."
stage: commit
---

# commit

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Everything below assumes you have read its header and stage material.

```harness
unit brief { "id": "<id>", "stage": "commit" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

## Procedure

1. Read your own diff (`vcs diff`) as a reviewer would and record `self_critique` findings with severities; an explicit empty list is valid.
2. For a bug, complete the `defect_repro` record with the green output, or record a `waiver` with a rationale.
3. Audit added lines for personal data flowing to logs, storage, analytics or error bodies; record `pii` (empty findings means clean) or a `waiver`.
4. Check the gates. Commit only through `vcs commit`; it refuses while a blocking gate fails and moves the unit to review when it succeeds.

## Calls

```harness
vcs diff { "id": "<id>" }
evidence record { "id": "<id>", "kind": "self_critique", "payload": { "findings": [] } }
evidence record { "id": "<id>", "kind": "pii", "payload": { "findings": [] } }
evidence gates { "id": "<id>" }
vcs commit { "id": "<id>", "message": "<id>: <what changed>" }
```

## Done when

`vcs commit` reports a sha and the unit is at review.
