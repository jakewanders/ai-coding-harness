---
name: screen
description: "Ticket validity triage: four structured verdict calls (technical and product, primary and second model) with a computed consensus."
flow: screen
argument-hint: "<source> [id] [mode]"
---

# screen

Follow @root/skills/_shared/standing-rules.md and @root/skills/_shared/style.md. Severity and
verdict vocabulary come from @root/skills/_shared/severity.md.

## First action

Start the unit from the ticket if it does not exist, then request the screen brief; it lists the
four calls with the id filled in and the tracker status hint.

```harness
unit start { "source": "ticket", "ref": "<id>" }
unit brief { "id": "<id>", "stage": "screen" }
```

## Procedure

1. Pin the ticket text (`spec pin`) so the verdicts are about what was actually written.
2. Make the technical and product calls as the primary model; then make the second calls as a second framing, arguing the opposite case first, and say so in their reasons.
3. Record all four with `evidence record` (kind `screen_verdict`), then list them and compute the consensus as the brief describes.
4. Report the verdict, agreement and dissent; propose the status hint only through the tracker role and only with the user's approval.

```harness
spec pin { "id": "<id>", "text": "<verbatim ticket>", "ref": "<id>" }
evidence record { "id": "<id>", "kind": "screen_verdict", "payload": { "dimension": "technical", "model": "primary", "verdict": "valid", "reasons": ["<reason>"] } }
evidence list { "id": "<id>", "kind": "screen_verdict" }
unit report { "id": "<id>", "stage": "screen", "outcome": "done", "summary": "<consensus verdict and dissent>" }
```

## Done when

Four `screen_verdict` records exist and the consensus has been reported to the user.
