# Changelog

## 0.2.0 — 2026-09-04 (lean)

A middle ground between the full 0.1.0 pipeline and an unstructured session. The core
value stays: the per-repo vault with digests, recall and the carry-forward ledger;
evidence gates that the hooks enforce even on a raw `git commit`; requirements pinned to
numbered acceptance criteria with a scope ledger in the PR body. Batch runs (`convoy`),
ticket triage (`screen`) and browser validation (`verify`) are kept.

### Collapsed
- Ten core stages → six: scope, build, review, verify, publish, close. Plan and commit
  fold into build (the build brief carries the plan and commit procedure; `vcs commit`
  moves build → review). Revise and challenge fold into review (a review verdict other
  than ship routes back to build; the adversarial pass is a review column).
- Fourteen gates → ten: check_command_green, self_critique_recorded,
  defect_repro_before_fix, pii_audit_clean guard build; review_verdict_ship and
  ledger_reverified guard review; walkthrough_done, criteria_validated, claims_audited
  guard publish; pr_recorded guards close.
- Twelve evidence kinds → nine (impact, reach_audit and counterweight removed);
  thirteen review columns → six (criteria_forward, criteria_reverse, adversarial,
  diffaudit, ledger, browser).
- Three modes → two: thorough and sketch (sketch skips review and verify).
- The cycle increments each time review starts again.

### Removed
- Flows shape, botprs, draft. Tool `reviewbot` and the post-publish bot loop (the pilot
  brief runs `respond` once when a bot requests changes). The counterweight seat and the
  second-opinion provider chain. Actions `unit explain`, `unit reconcile`,
  `pullreq worklog`, `digest handoff`, `system tokens`, `system sync`.
- `docs/token-budget.md` and its drift test.
- `analyze impact` and `analyze reach` are informational: they print results and record
  nothing.

### Migration
- 0.1.0 vault states read without a schema bump: the old stage names plan, commit and
  revise normalize to build, challenge to review, on read. `seats.counterweight` still
  validates in config and is ignored.


## 0.1.0 — 2026-09-04

First release of `harness`, the tracker-driven development lifecycle engine, as a
coding-agent plugin with a stdio MCP server, stage skills, safety hooks and one example kit.

### Tools (13)

`unit` (start, status, list, brief, explain, advance, report, route, answer, reconcile,
link), `spec` (record, pin, criteria, related, get), `analyze` (impact, pii, claims, reach,
criteria_map), `evidence` (record, list, gates, check, synthesize), `diffaudit` (run,
rules), `exec` (commands, run, logs), `vcs` (fetch, diff, branch, worktree, status, commit,
cleanup), `pullreq` (body, record, threads, get, worklog), `ledger` (add, list, recheck,
close), `reviewbot` (ready, poll, threads, round), `digest` (write, get, history, handoff,
wrapup), `recall` (search, reindex), `system` (version, health, kits, doctor, config, infer,
sync, tokens, seats). Every response ends with the versioned JSON envelope; the inventory in
`docs/tools.md` is generated from the registry.

### Stages (10) and brief contract

scope, plan, build, commit, review, revise, challenge, verify, publish, close. Each stage
skill opens with `unit brief`, whose header follows the published `harness-brief/1`
contract (`docs/brief-contract.md`) and carries the unit, mode, stage, repo, worktree, seat
wiring, capabilities, live gate statuses, selected kit docs and any config-load problems.

### Flows (10)

pilot (conductor with state-driven routing, checkpoints, reconciliation and the review-bot
loop), convoy (batch with file-overlap clustering and an approval checkpoint), screen (four
structured validity calls with consensus), shape (story readiness plus a drafted
clarification), inspect (read-only PR review), respond (one batched commit per round with
drafted replies), aftercare (fix now / new ticket / reply only), botprs (dependency-bot
classification), draft (ticket drafting, filed only after approval), setup (first-run
conversation ending in a confirmed `.harness.yaml`).

### Gates (14) and evidence

check_command_green, self_critique_recorded, defect_repro_before_fix, pii_audit_clean,
impact_recorded, reach_audit_recorded, ledger_reverified, counterweight_consulted,
review_verdict_ship, challenge_passed, walkthrough_done, criteria_validated,
claims_audited, pr_recorded. One resolver serves `unit advance`, `unit route`,
`unit explain`, the hooks and the brief header; modes may only demote, and every demotion
is listed in the PR body. Twelve evidence kinds with concrete schemas and remedies; review
columns synthesize into ship / needs_attention / not_ready per cycle; the counterweight
resolves CLI → HTTP → declared same-model stub with a per-class finding cap.

### Run modes

thorough, express (merged review dispatch, two gate demotions, verify after publish) and
sketch (scope through commit only, banner in the PR body), plus custom modes via `extends`.

### Hooks

`hooks/guard.mjs` binds to the host's Bash and Stop events with no dependencies: bypass
flags, protected branches, staged credentials, oversized files, personal-data sinks
(warn), commit and publish gates, transition preview and the stop status line. On an
unbuilt checkout it blocks `git commit`, `git push` and PR creation with build instructions
and lets everything else pass with a warning.

### Kits and configuration

Four configuration layers (defaults, kit fragments, user file, repo file) with per-key
provenance, line-numbered validation errors and zero-config inference for node, PHP,
Python, Go, Rust and Makefile repos. Kits are discovered on `HARNESS_KIT_PATHS`,
`~/.harness/kits`, the plugin cache and a sibling kits checkout; `examples/kits/web-ui`
ships one capability-selected doc, two diff-audit rules and one gate override.

### Distribution

`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.mcp.json`, committed
`dist/` verified by `npm run check:dist`, a hermetic vitest suite, and a vocabulary lint
that keeps product names out of shipped files.
