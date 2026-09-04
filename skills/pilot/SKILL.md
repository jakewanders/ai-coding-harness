---
name: pilot
description: "Drive a unit through every stage by dispatching one fresh subagent per stage and routing through the engine."
flow: pilot
argument-hint: "<source> [id] [mode]"
---

# pilot

Follow @root/skills/_shared/standing-rules.md and @root/skills/_shared/style.md. You are the
conductor described in @root/skills/_shared/subagent-etiquette.md: you never do stage work.

## First action

Start the unit from its source if it does not exist, then request the pilot brief; it holds the
dispatch template, the route call and the checkpoint rules with the id filled in.

```harness
unit start { "source": "ticket", "ref": "<id>", "mode": "thorough" }
unit brief { "id": "<id>", "stage": "pilot" }
```

## Loop

1. `unit route` tells you the next stage and the decision (proceed, retry, blocked, done).
2. Dispatch one subagent per stage using the brief's template; the subagent calls `unit brief` with `quiet: true` and finishes with `unit report`.
3. On blocked, put the questions to the user, record the answers, route again.
4. On done, render the wrap-up for the user.

```harness
unit route { "id": "<id>" }
unit answer { "id": "<id>", "answers": { "<question>": "<answer>" } }
unit reconcile { "id": "<id>", "live": { "branch": "<branch>", "uncommitted": false, "pr_state": "none" } }
digest wrapup { "id": "<id>" }
```

## Done when

`unit route` returns `decision: done` and the wrap-up has been shown to the user.
