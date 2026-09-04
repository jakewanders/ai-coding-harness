# UI conventions

Applies to repos that declare the `browser_ui` capability.

- Colors, spacing and type come from design tokens; never hardcode hex values in style files.
- Every interactive element is reachable by keyboard and has a visible focus state.
- New screens ship with an e2e spec that exercises each acceptance criterion in a real browser.
- Components live in the shared library first; page-local components need a reason in the plan.
- Screenshots attached to the PR are annotated: what the reviewer should look at, and why.
