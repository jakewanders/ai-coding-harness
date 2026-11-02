# Harness design spec

Date: 2026-09-04. Status: approved for planning.

This spec fixes the concrete decisions that `docs/blueprint.md` leaves open. The
blueprint defines *behavior*; this document defines *names, layouts, contracts, and
build order*. When the two seem to disagree, the blueprint's constraints in its sections
2, 4, 5, 8 and the loud-failure rule win, and this spec must be corrected.

Clean-room rule: this project is built from the blueprint and this spec only. The author's
earlier private prototypes (sibling directories) are
never opened, searched, or copied from. Their vocabulary (`phase`, `orchestrate`,
`dev-workflow`, `dev-mcp`) is on the jargon deny-list so accidental reuse fails CI.

## 1. Identity

| Item | Value |
|---|---|
| Repository | `ai-coding-harness` (remote `github.com/jakewanders/ai-coding-harness`) |
| Package name | `ai-coding-harness`, version `0.1.0`, ESM, Node ≥ 22 |
| Plugin name | `harness` |
| MCP server name | `harness`, stdio transport, entry `dist/server.js` |
| User config | `~/.harness/config.yaml` (override path with env `HARNESS_CONFIG`) |
| Repo config | `.harness.yaml` at the git root |
| Record store ("vault") | `~/.harness/vault` (override with config `store.path` or env `HARNESS_VAULT`) |
| Credentials | `~/.harness/.env` (dotenv), never in YAML |
| Kit search path | env `HARNESS_KIT_PATHS` (colon-separated), then `~/.harness/kits`, then the plugin manager cache, then `../ai-coding-harness-kits/kits` |
| Root notation in prose | `@root/` means the plugin install root, e.g. `@root/skills/_shared/style.md`. The brief header carries the absolute value. |

Stack: TypeScript compiled with `tsc` to `dist/` (committed), `vitest` for tests,
`@modelcontextprotocol/sdk` for the server, `zod` for per-action validation, `yaml` for
config. Package manager: npm with a committed `package-lock.json`. No other runtime
dependencies without a note in the build log explaining why.

## 2. Vocabulary

| Concept | Name |
|---|---|
| Work unit | unit |
| Core stages, in order | scope → plan → build → commit → review → [revise → commit → review]* → challenge → verify? → publish → close |
| Full-pipeline flow | pilot |
| Multi-unit batch flow | convoy |
| Ticket validity triage | screen |
| Story-readiness review | shape |
| Side-effect-free review of any PR | inspect |
| Address PR feedback | respond |
| Triage follow-up comments on a shipped unit | aftercare |
| Classify dependency-bot PRs | botprs |
| Draft and file a new ticket | draft |
| First-run setup conversation | setup |
| Run modes | thorough (full), express (thinned), sketch (prototype) |
| Rendered dynamic context | brief |
| Capability roles | seats: tracker, codehost, docs, design, chat, reviewbot, counterweight |
| Add-on opinion bundles | kits |
| Second-opinion model | counterweight |
| Carry-forward record | ledger |
| Story summary | digest |
| Cross-unit search | recall |

Stage meanings: scope = requirement research; revise = post-review correction;
challenge = once-per-unit fresh-eyes adversarial pass, sticky once passed; verify =
browser validation, only when the repo profile declares capability `browser_ui`;
close = archive, worktree cleanup, ledger update.

## 3. Repository layout

```
ai-coding-harness/
  .claude-plugin/plugin.json        manifest: name, version, skills, hooks, mcp server
  .claude-plugin/marketplace.json   single-plugin marketplace descriptor
  .mcp.json                         server entry for the plugin host
  hooks/hooks.json                  event → guard bindings
  hooks/guard.mjs                   committed plain-JS bootstrap (section 9)
  src/
    server.ts                       stdio entry; registers tools from the registry
    contracts/                      brief header + result envelope schemas (versioned)
    config/                         layers, merge, validation, inference, ticket patterns
    store/                          vault paths, state schema + migrations, history, index
    registry/                       stage table, gate registry, tool registry
    tools/<noun>.ts                 one file per tool, per-action zod schemas
    stages/<stage>.ts               brief renderers
    flows/<flow>.ts                 standalone flow renderers
    gates/                          gate check functions
    evidence/                       evidence kinds, schemas, remedies
    analysis/                       impact radius, personal-data audit, claims, reach
    review/                         columns, synthesis, counterweight resolution
    kits/                           discovery, manifest merge, doc selection, rule runner
    git/                            worktree, fetch, diff, commit, branch helpers
    hooks/                          guard implementations, host payload adapter
    text/                           ghostwriter templates (handoff, PR body, wrap-up)
  skills/
    _shared/                        style.md, scope-rules.md, severity.md,
                                    subagent-etiquette.md, standing-rules.md
    <stage or flow>/SKILL.md        one per stage and per standalone flow
    <stage>/modes/<mode>.md         mode-specific sections loaded on demand
  examples/kits/web-ui/             one example kit (section 10)
  test/                             vitest; mirrors src/, plus contract/ lint/ git/
  dist/                             committed build output
  docs/
    blueprint.md                    the source blueprint (read-only)
    superpowers/specs/…             this spec
    BUILD_PLAN.md                   the step checklist the loop executes
    BUILD_LOG.md                    one line per completed step
    BLOCKERS.md                     steps the loop could not finish and why
    brief-contract.md               published header contract
    tools.md                        generated tool/action inventory
```

## 4. Domain model and persistence

Unit id: opaque string. `^[A-Z][A-Z0-9]+-\d+$` is recognized as the tracker form for URL
templates and branch matching only. Untracked runs derive `local-<8 hex of sha256(source
text)>`.

Source kinds: `ticket`, `pr`, `url`, `file` (md/txt/html/pdf), `conversation`, `text`.
Entry signature everywhere: `<source> [id] [mode]`.

Vault layout (all paths written home-relative as `~/...`, expanded on read):

```
<vault>/.git                                store is git-initialized
<vault>/<repo-namespace>/units/<unit-id>/
  state.json        schema: 1; stage, mode, cycle, gates evidence index, timers
  source.md         pinned verbatim source text
  requirement.md    normalized requirement + acceptance criteria (numbered AC-1…)
  related.md        linked items, parent, siblings, prior PRs
  plan.md
  reviews/cycle-<n>.json
  commits.json
  runs/<run-id>.log      full output; state keeps {command, exit, summary, path}
  drafts/<name>.md       ghostwritten posts awaiting human approval
  history.md             running human-readable log
<vault>/<repo-namespace>/ledger.json         carry-forward entries
<vault>/index/digests.json                   keyword index over digests
```

`repo-namespace` is `<host>/<owner>/<name>` from the origin remote, or `local/<dirname>`
when there is no remote. State migrations: `store/migrations.ts` holds `1 → n` steps;
reading an old schema migrates in memory and writes back.

Store sync: `system sync` pushes/pulls the vault's git remote when `store.remote` is
configured; otherwise it returns `ok: true, summary: "sync skipped: no remote"`.

## 5. Configuration

Layers, rising precedence: built-in defaults → kit fragments (below defaults, above
nothing) → user file → repo file. Mappings merge recursively; lists and scalars replace.
Top-level `schema: 1`; any other value is rejected with a pointer to the migration note.

```yaml
schema: 1
store: { path: ~/.harness/vault, remote: null }
seats:
  tracker:   { fetch: [], comment: [], transition_hint: [] }
  codehost:  { open_pr: [], read_threads: [], comment: [], resolve_thread: [], attach: [] }
  docs: { search: [] }
  design: { fetch: [] }
  chat: { post: [] }
  reviewbot: { status: [], threads: [] }
  counterweight: { cli: null, http: null }
repos:
  <repo-namespace>:
    base_branch: main
    commands: { check: "", test: "", lint: "", typecheck: "", e2e: "", boot: "", install: "" }
    constraints: { package_manager: npm, test_flags: [] }
    subprojects: { <name>: { path: "", commands: {} } }
    tags: []
    capabilities: { isolation: worktree | branch, browser_ui: false, contracts: false,
                    component_library: false, daemon_warmup: "" }
environments:
  - { name: qa, url: "", role: sut | reference | production, env_prefix: QA_ }
tickets:
  - { pattern: "^ABC-\\d+$", repo: <repo-namespace>, subproject: null,
      url: "https://…/{id}", status_hints: { scope: "", build: "", publish: "", close: "" } }
gates: { <gate-id>: { severity: block | warn | off, requires: <capability> | null } }
custom_gates: [ { id: "", stage: "", command: "", severity: warn } ]
modes:
  <name>: { extends: thorough, demote: { <gate-id>: warn | off }, merge_dispatches: true,
            verify_after_publish: true }
kits: [ web-ui ]
protected_branches: [ main, master, release/* ]
```

A broken layer is skipped and recorded as `{file, key path, line, valid keys}`; the error
appears in every brief and in `system doctor`. Zero-config inference (`system infer`)
reads the remote, default branch, lockfile, and manifest scripts for node (`package.json`),
PHP (`composer.json`), Python (`pyproject.toml`), Go (`go.mod` + `Makefile`), Rust
(`Cargo.toml`), and `Makefile`, and returns each guess with an `evidence` string.

## 6. Tool surface

Thirteen tools. Each takes `action` plus that action's parameters, validated per action
with zod after dispatch. Every response is human text followed by one fenced `json` block:

```json
{ "v": 1, "ok": true, "summary": "…", "data": {}, "next": [ { "tool": "", "action": "", "why": "" } ] }
```

| Tool | Actions |
|---|---|
| `unit` | start, status, advance, explain, brief, reconcile, report, route, answer, list, link |
| `spec` | record, pin, get, criteria, related |
| `analyze` | impact, pii, claims, reach, criteria_map |
| `evidence` | record (kind), list, gates, check, synthesize |
| `exec` | run, commands, logs |
| `vcs` | worktree, fetch, diff, status, branch, commit, cleanup |
| `pullreq` | record, body, threads, get, worklog |
| `digest` | write, get, history, handoff, wrapup |
| `recall` | search, reindex |
| `ledger` | add, list, recheck, close |
| `reviewbot` | ready, poll, threads, round |
| `diffaudit` | run, rules |
| `system` | doctor, config (mode: merged / propose / write), infer, kits, seats, health, sync, version, tokens |

Rules: tool descriptions list actions computed from the registry; `docs/tools.md` is
generated by a script and a test fails if it is stale. `unit brief` accepts
`stage`, `id`, and `quiet: true` (suppresses the single-stage stop banner for pilot
dispatches). `unit explain` returns the next stage, its gates with live pass/fail, the
seats it consults, and what it produces, without mutating anything.

## 7. Brief contract

`unit brief` returns, in order: the fenced YAML header, the seat-wiring block, any
config-load problems, the source/spec block, then stage-specific material. Header
contract `harness-brief/1`, published in `docs/brief-contract.md`:

```yaml
contract: harness-brief/1
unit: ABC-123
mode: thorough
stage: build
repo: github.com/owner/name
worktree: ~/code/name-ABC-123
base_branch: main
root: /abs/plugin/root
seats: { tracker: [tool names] | unwired, codehost: …, … }
capabilities: { isolation: worktree, browser_ui: true, … }
gates: [ { id: self_critique_recorded, severity: block, status: pass | fail | n/a } ]
docs: [ /abs/path/to/convention.md ]
config_errors: [ { file, path, line, message } ]
```

Stage registry: one table in `src/registry/stages.ts` mapping name → renderer + flags
`{ takesNoId, standalone, specBanner }`. A test asserts every registered stage renders
with an empty config and an untracked unit.

## 8. Quality machinery

Gate registry entries `{ id, stage, description, severity, requires?, check(state) }`:

| Gate id | Stage guarded | Default |
|---|---|---|
| check_command_green | commit | block |
| self_critique_recorded | commit | block |
| defect_repro_before_fix | commit (bug-shaped units) | block, waivable |
| pii_audit_clean | commit | block, waivable |
| impact_recorded | review | warn |
| reach_audit_recorded | review | block |
| ledger_reverified | review | warn |
| counterweight_consulted | review | warn, requires seat |
| review_verdict_ship | challenge | block |
| challenge_passed | publish | block |
| walkthrough_done | publish | block, requires `browser_ui` |
| criteria_validated | publish | block |
| claims_audited | publish | block |
| pr_recorded | close | block |

One resolver (`gates/resolve.ts`) serves `unit advance`, `unit explain`, the hooks, and
the brief header. Modes may only demote; every demotion is listed in the PR body.

Evidence kinds for `evidence record`: `self_critique`, `defect_repro` (red then green),
`reach_audit`, `screen_verdict`, `impact`, `pii`, `criteria_validation`, `claims`,
`waiver` (gate id + rationale), `browser_findings`, `counterweight`, `review_column`.
Each kind has its own zod schema and remedy text. An explicit empty findings list is
valid; a missing record is not.

Review columns: `criteria_forward`, `criteria_reverse`, `architecture`, `security`,
`tests`, `performance`, `component_library` (requires capability), `accessibility`
(requires `browser_ui`), `diffaudit`, `ledger`, `adversarial`, `counterweight`,
`browser`. `evidence synthesize` merges the recorded columns for the current cycle into
`{ verdict: ship | needs_attention | not_ready, counts: { blocker, major, minor, note } }`
and writes `reviews/cycle-<n>.json`.

Counterweight resolution: configured CLI → HTTP endpoint (key from dotenv) → same-model
stub that reports `provider: fallback-stub`. Findings are tracked by class across cycles
with an iteration cap of 3 per class.

Run modes: `thorough` uses defaults. `express` merges the specialist columns into one
dispatch, demotes `reach_audit_recorded` and `counterweight_consulted` to warn, and moves
verify after publish. `sketch` runs one subagent from scope through commit, turns review,
challenge, and verify off, and the PR body opens with a banner stating nothing reviewed
the diff.

## 9. Safety hooks

`hooks/hooks.json` binds `PreToolUse` (Bash) and `Stop` to
`node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs" <guard>`. The bootstrap `guard.mjs` is
committed plain JavaScript with no dependencies. It tries to import
`../dist/hooks/index.js`; if that fails, it inspects the command itself: `git commit`,
`git push`, and PR-creation commands are **blocked** with build instructions, everything
else passes with a printed warning. Guards, all resolving the unit from the current branch
name and staying silent on no match:

`no_bypass_flags`, `protected_branch`, `credential_scan`, `oversize_file`,
`pii_sink_warn`, `commit_gate`, `publish_gate`, `transition_preview`, `stop_status`.

## 10. Kits

A kit is a directory with `kit.yaml` (a config fragment in the section 5 schema plus
`docs:` and `rules:` lists) and its files. Doc selection keys on `tags` and
`capabilities`. Rules are diff-audit entries `{ id, pattern (regex), files (glob),
severity, message }`. Kits may override gate severities and add custom gates.
The example kit `examples/kits/web-ui` ships one convention doc selected by
`browser_ui`, two diff rules, and one gate override, and is loaded in tests via
`HARNESS_KIT_PATHS`. The core runs fully with no kits.

## 11. Pilot, convoy, and wrap-up

`pilot` dispatches one fresh subagent per stage with a prompt built by `unit brief`
(`quiet: true`) plus a pointer to `@root/skills/_shared/standing-rules.md`. After each
subagent, `unit route` returns `{ next, decision: proceed | retry | blocked | done,
verdict, questions }`. Blocked questions are shown to the user and stored with `unit
answer`. Resumed sessions call `unit reconcile` first. After publish, if the reviewbot seat
is wired, a loop of at most two rounds runs `reviewbot ready → poll → threads → respond`.
`digest wrapup` renders the PR link, the stage table from state, the scope ledger
(criterion → proof → status), the not-built list, held drafts, and for reduced modes a
"what this run did not prove" section. `convoy` runs scope+plan for several ids, clusters
by predicted file overlap, asks the user to approve the grouping, then pilots each group.

## 12. Testing strategy

- Hermetic: `HARNESS_CONFIG` and `HARNESS_VAULT` point at temp fixtures in every test via
  a shared setup file; a test fails if either resolves under the real home directory.
- Contract tests: header schema, envelope schema, tool and action inventory computed from
  the registry, every stage renders on empty config, every skill has valid frontmatter,
  references only `@root/` paths that exist, and names only registered tools and actions.
- Vocabulary lint: a test scans every file under `src/`, `skills/`, `hooks/`,
  `examples/`, and `README.md` for the deny-list and fails on any hit not on a line
  containing `harness-lint: allow`. The deny-list holds product names (ticket systems,
  code hosts, chat tools, design tools, review bots, frameworks) and the sibling
  vocabulary from the clean-room rule.
- Real-git tests in temp repos for inference, diff against remote refs, worktree
  creation, commit guard, and protected-branch guard.
- `npm test`, `npm run typecheck`, and `npm run build` must all pass before every commit.
  A `check:dist` script rebuilds and fails if `dist/` differs from the committed tree.

## 13. Distribution

`plugin.json` declares skills, hooks, and the MCP server explicitly. `marketplace.json`
lists this one plugin so installation is add-marketplace then install. `dist/` is
committed. `setup` runs `system doctor`, maps the session's visible tool names onto seats
by heuristics (the only place product names appear, on allow-marked lines), asks about
reviewbot, counterweight, kits, and environments, shows the proposed `.harness.yaml`,
and writes it only on confirmation. `system tokens` measures the total instruction load
(skill files + briefs) of a full thorough run and reports it in the final audit.

## 14. Non-goals

Per the blueprint: no hosted model calls, no stored third-party credentials, no direct
tracker mutation, no deployment management, no framework knowledge in the core. Also out
of scope for this build: a separate kits repository, a web UI, and any host other than the
stdio MCP transport plus the plugin manifest.
