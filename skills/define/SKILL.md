---
name: define
description: "Requirement research: pin the source, normalize it into numbered acceptance criteria, record related items."
stage: define
---

# define

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Everything below assumes you have read its header and stage material.

```harness
unit brief { "id": "<id>", "stage": "define" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

## Procedure

1. Read the source block in the brief. If it says "no pinned source", fetch the ticket through the tracker role (or ask the user for the text) and pin it verbatim.
2. Normalize the requirement into a title and a body in your own words; keep the tracker url.
3. Extract numbered acceptance criteria, each testable in one sentence. Infer the unit kind (bug when a defect is described).
4. Cross-check against linked items, the parent and prior PRs; record them as related items. Stop and ask on a contradiction.
5. Search prior decisions from the brief's "Prior decisions" section before finalizing.

## Calls

```harness
spec pin { "id": "<id>", "text": "<verbatim source>", "ref": "<ticket key or url>" }
spec record { "id": "<id>", "title": "<title>", "body": "<normalized requirement>", "url": "<tracker url>" }
spec criteria { "id": "<id>", "set": ["<AC-1 text>", "<AC-2 text>"] }
spec related { "id": "<id>", "items": [{ "kind": "parent", "ref": "<key>", "title": "<title>" }] }
recall search { "query": "<key terms from the title>" }
```

## Done when

`spec get` shows a title, a body and at least one criterion, and `unit advance` succeeds.
