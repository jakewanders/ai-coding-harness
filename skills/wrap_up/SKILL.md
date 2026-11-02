---
name: wrap_up
description: "Archive the unit: clean up the worktree, update the ledger, write the digest, and mark the ticket per the status hint."
stage: wrap_up
---

# wrap_up

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Everything below assumes you have read its header and stage material.

```harness
unit brief { "id": "<id>", "stage": "wrap_up" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

## Procedure

1. Write the digest: one-paragraph summary, the decisions taken, tags.
2. Render the wrap-up and hand it to the user.
3. Remove the worktree and delete the branch when merged.
4. Apply the wrap_up status hint through the tracker seat only with approval.

## Calls

```harness
digest write { "id": "<id>", "summary": "<one paragraph>", "decisions": ["<decision>"], "tags": ["<tag>"] }
digest wrapup { "id": "<id>" }
vcs cleanup { "id": "<id>" }
unit advance { "id": "<id>" }
```

## Done when

The digest exists, the worktree is gone, and the unit is at wrap_up.
