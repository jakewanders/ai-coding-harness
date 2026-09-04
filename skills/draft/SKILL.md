---
name: draft
description: "Draft a new ticket from a plain-language request (title, context, AC-n criteria, out of scope) and file it only after approval."
flow: draft
argument-hint: "<source> [id] [mode]"
---

# draft

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md.

## First action

Start a unit from the request text so the draft has a home, then request the draft brief.

```harness
unit start { "source": "text", "text": "<the request as given>" }
unit brief { "id": "<id>", "stage": "draft" }
```

## Procedure

1. Write the ticket into `drafts/ticket.md` using the brief's template: title, context, numbered testable criteria, out of scope.
2. Show the draft to the user and revise until they approve.
3. File it through the tracker seat's create tool only after approval; if none is wired, hand the draft over for manual filing.

```harness
spec pin { "id": "<id>", "text": "<the request as given>" }
unit report { "id": "<id>", "stage": "draft", "outcome": "done", "summary": "<title> drafted; awaiting approval to file" }
```

## Done when

The user has approved the draft and it has been filed or handed over.
