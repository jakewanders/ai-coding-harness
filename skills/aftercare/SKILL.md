---
name: aftercare
description: "Triage follow-up comments on a shipped unit into fix now, new ticket, or reply only, with drafted text for each."
flow: aftercare
argument-hint: "<source> [id] [mode]"
---

# aftercare

Follow @root/skills/_shared/standing-rules.md and @root/skills/_shared/style.md.

## First action

Pull the follow-up comments into the unit's PR threads, then request the aftercare brief; it
buckets them and drafts text at `drafts/aftercare.md`.

```harness
pullreq threads { "id": "<id>", "threads": [] }
unit brief { "id": "<id>", "stage": "aftercare" }
```

## Procedure

1. Re-check the heuristic buckets: a defect the change introduced is fix now; anything beyond the shipped criteria is a new ticket; questions are reply only.
2. Fix now: start a follow-up unit from the PR and pilot it; do not patch the shipped branch ad hoc.
3. New ticket: draft it with the `draft` flow and link it in the reply.
4. Post replies only with the user's approval.

```harness
unit start { "source": "pr", "ref": "<pr url>", "mode": "express" }
ledger add { "kind": "ask", "text": "<standing ask from a comment>", "id": "<id>" }
unit report { "id": "<id>", "stage": "aftercare", "outcome": "done", "summary": "<buckets and actions>" }
```

## Done when

Every open comment sits in a bucket with drafted text and the user has seen the plan.
