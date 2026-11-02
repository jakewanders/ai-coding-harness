---
name: convoy
description: "Batch several units: define each, cluster by predicted file overlap, get the grouping approved, then pilot the groups sequentially."
flow: convoy
argument-hint: "<source> [id] [mode]"
---

# convoy

Follow @root/skills/_shared/standing-rules.md and @root/skills/_shared/style.md; you are a
conductor per @root/skills/_shared/subagent-etiquette.md and never do stage work yourself.

## First action

Request the convoy brief; it carries the steps, the clustering rule and the approval checkpoint.

```harness
unit brief { "stage": "convoy" }
```

## Procedure

1. Start each unit and run define for it through the pilot loop, stopping after define; the requirement's `Files:` line feeds the clustering.
2. Cluster by predicted file overlap as the brief describes; present the grouping and wait for approval.
3. Link siblings with `unit link`, then pilot each approved group sequentially with @root/skills/pilot/SKILL.md.
4. Finish with one wrap-up per unit and a batch summary.

```harness
unit start { "source": "ticket", "ref": "<id>" }
unit link { "id": "<id>", "related": ["<sibling id>"] }
digest wrapup { "id": "<id>" }
```

## Done when

Every unit in every approved group has reached wrap_up, and the batch summary has been shown.
