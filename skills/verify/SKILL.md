---
name: verify
description: "Validate the change in a real browser against every acceptance criterion when the repo declares browser_ui."
stage: verify
---

# verify

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Everything below assumes you have read its header and stage material.

```harness
unit brief { "id": "<id>", "stage": "verify" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

## Procedure

1. Pick the environment by role from the brief (`sut` for the change, `reference` for comparisons). Boot the app with the repo's boot command if needed.
2. Exercise every acceptance criterion in the browser, including the edge cases each implies. No roaming regression sweeps.
3. Record `browser_findings` with `in_scope` set honestly; out-of-scope observations cannot drive the verdict.
4. Record `criteria_validation` per criterion with the proof.

## Calls

```harness
exec run { "id": "<id>", "name": "boot" }
evidence record { "id": "<id>", "kind": "browser_findings", "payload": { "environment": "<name>", "findings": [] } }
evidence record { "id": "<id>", "kind": "criteria_validation", "payload": { "results": [{ "criterion": "AC-1", "status": "proven", "proof": "<what you saw>" }] } }
```

## Done when

Every criterion has a validation result and `unit advance` succeeds.
