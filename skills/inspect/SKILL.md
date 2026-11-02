---
name: inspect
description: "Side-effect-free review of any pull request: run the review columns read-only and report a verdict."
flow: inspect
argument-hint: "<source> [id] [mode]"
---

# inspect

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/style.md and the severity
rubric in @root/skills/_shared/severity.md. This flow is read-only: no commits, no pushes, no posts.

## First action

Start a unit from the PR reference (its id becomes `pr-<number>`), then request the inspect brief.

```harness
unit start { "source": "pr", "ref": "<pr url or #number>" }
unit brief { "id": "pr-<number>", "stage": "inspect" }
```

## Procedure

1. Read the diff and the PR description. Fetch through the codehost role, or `vcs diff` when the branch is checked out.
2. Record each review column as `review_column`; record nothing else.
3. Synthesize and report the verdict with the top findings. Never post to the PR from this flow.

```harness
vcs diff { "id": "pr-<number>" }
evidence record { "id": "pr-<number>", "kind": "review_column", "payload": { "column": "security", "findings": [] } }
evidence synthesize { "id": "pr-<number>" }
unit report { "id": "pr-<number>", "stage": "inspect", "outcome": "done", "summary": "<verdict and top findings>" }
```

## Done when

The verdict and findings have been shown to the user.
