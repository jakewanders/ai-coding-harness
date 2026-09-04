# harness

`harness` is a tracker-driven development lifecycle engine packaged as a coding-agent
plugin: a stdio MCP server that acts as bookkeeper, ghostwriter, and gatekeeper over a
git-initialized local record vault, a set of stage skills that request a server-rendered
brief before acting, safety hooks that fail loudly, and an example kit. The engine never
contacts external systems; it keeps units of work honest as they move from scope through
build, review, verify, and publish.

## Install

Add this repository as a plugin marketplace, then install the `harness` plugin. The plugin
manifest lives in `.claude-plugin/plugin.json`; it declares the skills, the hooks in
`hooks/hooks.json`, and the MCP server entry `dist/server.js`. The build output in `dist/`
is committed, so a fresh clone works without a build step; `npm run check:dist` verifies it.

```sh
npm install && npm run build && npm test
```

## Quick start (zero config)

1. Open a repository and run the `setup` skill once. It runs `system doctor`, maps your
   session's tools onto seats, asks about bots, kits and environments, and writes
   `.harness.yaml` only after you confirm. With no config at all the engine still works:
   commands are inferred from the manifest and lockfile.
2. Start a unit from a ticket, a PR, a url, a file, or plain text with `unit start`, then
   run the `pilot` skill. Pilot dispatches one fresh subagent per stage, routes with
   `unit route`, and stops for you when a stage is blocked.
3. Every stage skill opens with `unit brief`, which renders the header contract
   (`docs/brief-contract.md`), the seat wiring, the requirement, the plan and the exact
   tool calls with the unit id filled in.

## Stages and flows

Six core stages: scope, build, review, verify (only when the repo declares `browser_ui`),
publish, close. Build carries the plan and the commit; `vcs commit` refuses until the
self-critique, the personal-data audit and a green check run exist for the cycle, then
moves the unit to review. Review records the criteria columns, the diff-audit rules, the
ledger recheck and a fresh-eyes adversarial pass, then synthesizes one verdict; findings
route the unit back to build and the cycle counts up.

Seven standalone flows: `pilot` (conductor), `convoy` (batch with file-overlap clustering
and an approval checkpoint), `screen` (ticket triage with four structured calls and a
consensus), `inspect` (read-only PR review), `respond` (one batched commit per review
round), `aftercare` (fix now / new ticket / reply only), `setup`.

## Tools

Twelve noun-grouped tools, each taking an `action`: `unit`, `spec`, `analyze`,
`evidence`, `diffaudit`, `exec`, `vcs`, `pullreq`, `ledger`, `digest`, `recall`, and
`system`. Every response ends with a versioned JSON envelope. The full inventory is
generated from the registry into `docs/tools.md`.

## Seats

Capability roles the engine consults: `tracker`, `codehost`, `docs`, `design`, `chat`,
and `reviewbot`. Each seat lists the tool names that fill it; an unwired seat means "skip
the steps that need it and say so". `system seats` proposes the wiring from your
session's tool names.

## Modes

`thorough` runs everything. `sketch` runs one subagent from scope through build, skips
review and verify, and opens the PR body with a banner stating nothing reviewed the diff.
Custom modes extend these in config; every demotion is listed in the PR body under a
"Not proven" section.

## Kits

A kit is a directory with `kit.yaml` (a config fragment plus `docs` and `rules`) found on
`HARNESS_KIT_PATHS`, `~/.harness/kits`, the plugin cache, or a sibling kits checkout.
Docs are selected by repo tags and capabilities into the brief header; rules run as the
`diffaudit` review column. `examples/kits/web-ui` is the shipped example.

## Hooks

`hooks/guard.mjs` binds to the host's Bash and Stop events. It blocks verification bypass
flags, pushes to protected branches, staged credentials and oversized files, commits that
fail the unit's build gates, and pushes or PR creation that fail the publish gates; it
warns on personal data heading to a sink and prints the unit status on stop. On an unbuilt
checkout it blocks `git commit`, `git push` and PR creation with build instructions and
lets everything else pass with a warning.

## Configuration

Layers, rising precedence: built-in defaults, kit fragments, `~/.harness/config.yaml`
(or `HARNESS_CONFIG`), then `.harness.yaml` at the git root. Mappings merge, lists and
scalars replace. A broken layer is skipped and reported in every brief and in `system
doctor`. The schema is spec section 5 in
`docs/superpowers/specs/2026-09-04-harness-design.md` with the 0.2.0 delta in
`docs/superpowers/specs/2026-09-04-lean-harness.md`; `system config` shows the merged
result with provenance, proposes a repo file, and writes it on request.
