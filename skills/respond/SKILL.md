---
name: respond
description: "Address PR review feedback: one batched commit per round, one drafted reply per thread, threads resolved on the host."
flow: respond
argument-hint: "<source> [id] [mode]"
---

# respond

Follow @root/skills/_shared/standing-rules.md, @root/skills/_shared/scope-rules.md and
@root/skills/_shared/style.md.

## First action

Pull the current threads into state, then request the respond brief; it groups them by file and
scaffolds `drafts/replies.md`.

```harness
pullreq threads { "id": "<id>", "threads": [] }
unit brief { "id": "<id>", "stage": "respond" }
```

## Procedure

1. Decide per thread: fix, reply, or defer. Fixes stay inside the acceptance criteria; anything else is deferred.
2. Make all fixes, run the check command, land exactly one batched commit for the round.
3. Fill `drafts/replies.md`; post replies through the codehost seat only with the user's approval.
4. Resolve on the host only the threads whose fix landed.

```harness
exec run { "id": "<id>", "name": "check" }
vcs commit { "id": "<id>", "message": "<id>: address review round <n>" }
pullreq get { "id": "<id>" }
```

## Done when

Every open thread has a decision and a drafted reply, and the round's commit has landed.
