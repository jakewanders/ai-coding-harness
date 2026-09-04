---
name: setup
description: "First-run setup conversation: doctor, seat mapping from visible tools, questions about bots, second-opinion model, kits and environments, then write the approved repo config."
flow: setup
argument-hint: "<source> [id] [mode]"
---

# setup

Follow @root/skills/_shared/standing-rules.md and @root/skills/_shared/style.md.

## First action

Request the setup brief; it walks the five steps in order.

```harness
unit brief { "stage": "setup" }
```

## Procedure

1. `system doctor` and explain the report in plain words.
2. `system seats` with every visible tool name; confirm the mapping with the user.
3. Ask about the review bot, the counterweight model, kits and environments.
4. Show the proposal from `system config` in propose mode and revise it with the user.
5. Write it with `system config` in write mode only after the user confirms.

```harness
system doctor { }
system seats { "tools": ["<every visible tool name>"] }
system config { "mode": "propose" }
system config { "mode": "write", "yaml": "<approved yaml>" }
```

## Done when

`.harness.yaml` is written with the user's approval and `system doctor` reports no config problems.
