---
name: shape
description: "Story-readiness review: criteria present and testable, links resolved, ambiguities listed, with a ghostwritten clarification question."
flow: shape
argument-hint: "<source> [id] [mode]"
---

# shape

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md.

## First action

Start the unit if needed, record what the ticket says, then request the shape brief; it assesses
readiness and drafts the clarification question.

```harness
unit start { "source": "ticket", "ref": "<id>" }
spec record { "id": "<id>", "title": "<title>", "body": "<ticket text, normalized>" }
spec criteria { "id": "<id>", "set": ["<criterion as written>"] }
unit brief { "id": "<id>", "stage": "shape" }
```

## Procedure

1. Read the readiness section: missing or vague criteria, ambiguous sentences, unresolved links.
2. Where the ticket can be fixed without asking, propose testable criteria and record them; never invent scope the author did not imply.
3. Review `drafts/clarify.md`; edit it for tone per the style guide. Send it through the tracker seat only with the user's approval.
4. Report ready or not ready with the reasons.

```harness
spec related { "id": "<id>", "items": [{ "kind": "parent", "ref": "<key>", "title": "<title>" }] }
unit report { "id": "<id>", "stage": "shape", "outcome": "done", "summary": "<ready or not, and why>" }
```

## Done when

The readiness verdict and the clarification draft have been shown to the user.
