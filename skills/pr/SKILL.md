---
name: pr
description: "Ghostwrite the PR body from the record, list every mode demotion, and open the pull request through the codehost role."
stage: pr
---

# pr

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md throughout. Severity levels are defined in
@root/skills/_shared/severity.md. If you were dispatched as a subagent, also follow
@root/skills/_shared/subagent-etiquette.md.

## First action

Request the brief. Everything below assumes you have read its header and stage material.

```harness
unit brief { "id": "<id>", "stage": "pr" }
```

If the header's `contract` is not `harness-brief/1`, stop and report.

If the header mode is `sketch`, also read @root/skills/pr/modes/sketch.md. Other modes need
no extra reading.

## Procedure

1. Record `criteria_validation` for every criterion and a `claims` audit over the factual statements the PR body will make.
2. Render the PR body; read it as the reviewer will. Do not edit the scope ledger or waivers by hand.
3. Open the PR through the codehost role only with the user's approval; otherwise leave `drafts/pr-body.md` for them.
4. Record the PR url, then apply the tracker status hint if the tracker role is wired. `unit advance` to wrap_up refuses without a recorded PR; if the user chose not to open one, record a `waiver` for `pr_recorded` with that rationale instead.

## Calls

```harness
evidence record { "id": "<id>", "kind": "claims", "payload": { "claims": [] } }
pullreq body { "id": "<id>" }
pullreq record { "id": "<id>", "url": "<pr url>", "number": 0, "base": "<base>", "head": "<branch>" }
evidence record { "id": "<id>", "kind": "waiver", "payload": { "gate": "pr_recorded", "rationale": "<why no PR was opened>" } }   # only when no PR is opened
```

## Done when

`pullreq get` shows the PR and `unit advance` succeeds.
