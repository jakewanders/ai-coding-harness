---
name: botprs
description: "Classify open dependency-bot pull requests into auto-merge, needs-review, or hold using semver and lockfile-only heuristics."
flow: botprs
argument-hint: "<source> [id] [mode]"
---

# botprs

Follow @root/skills/_shared/standing-rules.md and @root/skills/_shared/style.md.

## First action

Request the botprs brief; it carries the heuristics and says whether the codehost seat can list PRs.

```harness
unit brief { "stage": "botprs" }
```

## Procedure

1. List open bot-authored PRs with the codehost tools named in the brief. If the seat is unwired, skip and say so.
2. Classify each PR with the brief's heuristics, reading the diff rather than the title.
3. Report one line per PR and write one digest for the batch. Merging happens only with the user's approval.

```harness
unit start { "source": "text", "text": "bot PR triage batch <date>" }
digest write { "id": "<batch unit id>", "summary": "<counts>", "decisions": ["<number>: <bucket> — <reason>"], "tags": ["botprs"] }
```

## Done when

Every open bot PR has a bucket and a reason, and the digest is written.
