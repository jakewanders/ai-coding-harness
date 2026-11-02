---
name: walkthrough
description: "Validate the change in a real browser against every acceptance criterion when the repo declares browser_ui."
stage: walkthrough
---

# walkthrough

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Its Walkthrough section lists every criterion, the environments by role, the e2e command, and the screenshot and scope rules.

```harness
unit brief { "id": "<id>", "stage": "walkthrough" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

## Procedure

1. Use the `sut` environment from the brief. Credentials are named by env var; read them from `~/.harness/.env` yourself and never write their values into notes, findings or the PR.
2. Boot the app if needed, then exercise every acceptance criterion in the browser, including the edge cases the brief asks you to derive. Record `pass`, `fail` or `blocked` per criterion with what you saw.
3. Reproduce any runtime error against the `reference` environment before treating it as a regression; list them in `runtime_errors`.
4. Run the e2e suite through `exec run` and record `{ command, exit }`; set `e2e: null` only when none exists.
5. Take an annotated screenshot per criterion; attach through the codehost seat when wired, otherwise keep the paths and say the attachment was skipped.
6. Out-of-scope observations go into `out_of_scope`; they never change a criterion's result.

## Calls

```harness
exec run { "id": "<id>", "name": "boot" }
exec run { "id": "<id>", "name": "e2e" }
evidence record { "id": "<id>", "kind": "browser_findings", "payload": { "criteria": [{ "id": "AC-1", "result": "pass", "notes": "<what you saw>", "screenshots": [] }], "runtime_errors": [], "e2e": { "command": "<e2e command>", "exit": 0 }, "out_of_scope": [] } }
evidence check { "id": "<id>", "gate": "walkthrough_done" }
```

## Done when

Every criterion has a browser result, `walkthrough_done` passes, and `unit advance` succeeds.
