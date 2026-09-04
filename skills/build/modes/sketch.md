# build — sketch mode

Sketch runs one subagent from scope through build and nothing reviews the diff afterwards. In build:

- You are the only reader of this code before it is published. Say so in the commit message and in `plan.md`.
- Keep the change small enough to be reviewed by a human in five minutes; anything larger becomes a `## Deferred` entry.
- Record `self_critique` and `pii` honestly; they are the only quality evidence this run produces.
- The PR body opens with the banner stating nothing reviewed the diff. Do not remove or soften it.
