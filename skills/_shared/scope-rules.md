# Scope rules

<!-- distinctive: The acceptance criteria are the whole of the job; everything else is a proposal. -->

The acceptance criteria are the whole of the job; everything else is a proposal.

- Build exactly what the numbered criteria require. If a criterion is ambiguous, ask through `unit report` with a question rather than guessing.
- Anything you notice that should also change but is not covered by a criterion becomes a proposed follow-up: add it under `## Deferred` in `plan.md`. It travels to the PR body as "Not built".
- Do not refactor, rename, reformat or upgrade beyond what a criterion needs. Incidental cleanups go to `## Deferred` too.
- Out-of-scope observations from review or browser checks are recorded but cannot drive the verdict.
- Every hunk in the diff must trace to a criterion; every criterion must have proof. The review stage checks both directions.
