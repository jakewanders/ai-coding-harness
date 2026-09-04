# Harness Build Plan

> **For agentic workers:** this plan is executed by the ralph loop described in
> `docs/MASTER_PROMPT.md`. Each task below is one loop iteration. Tasks use checkbox
> syntax: `- [ ]` open, `- [x]` done, `- [!]` blocked (entry required in
> `docs/BLOCKERS.md`). Every task follows the same cycle: write the failing tests listed
> under **Tests must assert**, run them and see them fail, implement the minimum that
> satisfies **Interfaces**, run the full suite plus typecheck plus build, commit with the
> message `step NN: <title>`, tick the box, append one line to `docs/BUILD_LOG.md`.

**Goal:** Build `harness`, the tracker-driven development lifecycle engine from
`docs/blueprint.md`, as a Claude Code plugin with an MCP server, skills, safety hooks, one
example kit, and a dense hermetic test suite, ready to push as `v0.1.0`.

**Architecture:** A stdio MCP server exposes thirteen noun-grouped tools that act as
bookkeeper, ghostwriter, and gatekeeper over a git-initialized local vault. Static skill
files per stage request a server-rendered brief as their first action. A gate registry
resolved by one function serves transitions, explain, hooks, and the brief header. The
engine never contacts external systems.

**Tech Stack:** TypeScript (strict, ESM) on Node 22, `@modelcontextprotocol/sdk`, `zod`,
`yaml`, `vitest`, `tsc` to a committed `dist/`.

**Spec:** `docs/superpowers/specs/2026-09-04-harness-design.md` (the spec) and
`docs/blueprint.md` (the blueprint). Section numbers below refer to the spec unless
prefixed `B` for the blueprint.

## Global Constraints

- Clean room: never open `../dev-mcp-2`, `../dev-mcp-orchestrator`, `../dev-workflow-packs`.
- Never `git push`. Never edit `docs/blueprint.md`.
- Runtime dependencies are exactly `@modelcontextprotocol/sdk`, `zod`, `yaml`. Adding one
  needs a justification line in `docs/BUILD_LOG.md`.
- Tests are hermetic: no network, temp vault and fixture config via `HARNESS_VAULT` and
  `HARNESS_CONFIG`, never the real home directory, never dependent on the cwd being a git
  checkout.
- The vocabulary lint (Task 2) stays at zero hits; escape only with `harness-lint: allow`
  on the same line.
- `dist/` is rebuilt and committed with every change under `src/` or `hooks/`.
- All vault paths serialize home-relative (`~/...`). All prose references to plugin files
  use `@root/`.
- Tool descriptions and `docs/tools.md` are generated from the registry, never typed.
- Every response from every tool action ends with the versioned JSON envelope.

## Shared interfaces

These names are used across tasks. Later tasks consume them exactly as written here.

```ts
// src/contracts/envelope.ts
export interface NextAction { tool: string; action: string; why: string }
export interface Envelope<T = unknown> { v: 1; ok: boolean; summary: string; data: T; next: NextAction[] }
export function envelope<T>(ok: boolean, summary: string, data: T, next?: NextAction[]): Envelope<T>
export function renderResponse(text: string, env: Envelope): string  // text + blank line + fenced json

// src/contracts/header.ts
export const BRIEF_CONTRACT = 'harness-brief/1'
export const HeaderSchema: z.ZodType<BriefHeader>
export interface BriefHeader {
  contract: 'harness-brief/1'; unit: string; mode: string; stage: string; repo: string
  worktree: string | null; base_branch: string; root: string
  seats: Record<SeatName, string[] | 'unwired'>
  capabilities: Record<string, unknown>
  gates: Array<{ id: string; severity: Severity; status: 'pass' | 'fail' | 'n/a' }>
  docs: string[]; config_errors: ConfigError[]
}
export function renderHeader(h: BriefHeader): string   // fenced yaml block

// src/store/paths.ts
export function homeRelative(abs: string, home?: string): string
export function expandHome(p: string, home?: string): string
export function vaultRoot(env?: NodeJS.ProcessEnv, storePath?: string | null): string
export function repoNamespace(remoteUrl: string | null, dirName: string): string
export function unitDir(vault: string, ns: string, id: string): string

// src/store/state.ts
export const STATE_SCHEMA = 1
export type StageName = 'scope'|'plan'|'build'|'commit'|'review'|'revise'|'challenge'|'verify'|'publish'|'close'
export type UnitKind = 'feature' | 'bug' | 'chore' | 'unknown'
export interface RunRecord { id: string; command: string; exit: number; summary: string; log: string; started_at: string; ended_at: string }
export interface CommitRecord { sha: string; message: string; at: string; cycle: number }
export interface PrRecord { url: string; number: number | null; base: string; head: string; opened_at: string; threads: Thread[] }
export interface Thread { id: string; author: string; body: string; path?: string; line?: number; resolved: boolean }
export interface TimerRecord { stage: StageName; started_at: string; ended_at: string | null; idle_gaps_ms: number }
export interface EvidenceRecord { kind: EvidenceKind; cycle: number; recorded_at: string; payload: unknown }
export interface UnitState {
  schema: 1; id: string; repo: string; tracked: boolean
  source: { kind: SourceKind; ref: string | null; pinned: boolean }
  mode: string; stage: StageName; cycle: number; kind: UnitKind
  worktree: string | null; branch: string | null; base_branch: string
  evidence: EvidenceRecord[]; commits: CommitRecord[]; runs: RunRecord[]
  pr: PrRecord | null; timers: TimerRecord[]; answers: Record<string, string>
  challenge_passed: boolean; created_at: string; updated_at: string
  reports?: Record<string, Report[]>          // Task 19: per stage, per cycle
  reviews?: Record<number, ReviewVerdict>     // Task 21: synthesized verdict per cycle
  bot?: { round: number; status: string; threads: Thread[] }   // Task 30
}
export interface Report { stage: string; cycle: number; outcome: 'done'|'blocked'|'failed'; summary: string; questions: string[]; verdict?: ReviewVerdict; artifacts: Record<string,string>; at: string }
export type ReviewVerdict = 'ship' | 'needs_attention' | 'not_ready'
export type SourceKind = 'ticket' | 'pr' | 'url' | 'file' | 'conversation' | 'text'
export function createState(init: Pick<UnitState, 'id'|'repo'|'tracked'|'source'|'mode'|'base_branch'>): UnitState
export function readState(dir: string): UnitState      // migrates and writes back if old
export function writeState(dir: string, s: UnitState): void
export function migrate(raw: unknown): UnitState        // src/store/migrations.ts
export function appendHistory(dir: string, line: string): void

// src/config/load.ts
export interface ConfigError { file: string; path: string; line: number | null; message: string; valid_keys?: string[] }
export interface LayerReport { name: 'defaults' | 'kit' | 'user' | 'repo'; file: string | null; ok: boolean; error?: ConfigError }
export interface LoadedConfig { config: HarnessConfig; layers: LayerReport[]; errors: ConfigError[] }
export function loadConfig(opts: { cwd: string; env?: NodeJS.ProcessEnv; kitFragments?: Partial<HarnessConfig>[] }): LoadedConfig
export function deepMerge<T>(base: T, over: Partial<T>): T   // maps merge, lists and scalars replace
// src/config/schema.ts exports HarnessConfig (zod-inferred) mirroring spec section 5, plus DEFAULTS.
export type SeatName = 'tracker' | 'codehost' | 'docs' | 'design' | 'chat' | 'reviewbot' | 'counterweight'

// src/registry/tools.ts
export interface ToolContext { cwd: string; env: NodeJS.ProcessEnv; config: LoadedConfig; vault: string; root: string; now: () => Date }
export interface ToolResult { text: string; envelope: Envelope }
export interface ActionDef<S extends z.ZodTypeAny = z.ZodTypeAny> { describe: string; schema: S; handler: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolResult> }
export interface ToolDef { name: string; description: string; actions: Record<string, ActionDef> }
export function defineTool(def: ToolDef): ToolDef
export function describeTool(t: ToolDef): string       // description + computed action list
export function dispatch(t: ToolDef, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>
export function allTools(): ToolDef[]                    // src/registry/index.ts

// src/registry/stages.ts
export type FlowName = 'pilot'|'convoy'|'screen'|'shape'|'inspect'|'respond'|'aftercare'|'botprs'|'draft'|'setup'
export interface BriefContext { state: UnitState | null; config: LoadedConfig; header: BriefHeader; vault: string; root: string; quiet: boolean; unitDir: string | null }
export type BriefRenderer = (ctx: BriefContext) => string
export interface StageEntry { name: StageName | FlowName; render: BriefRenderer; takesNoId: boolean; standalone: boolean; specBanner: boolean }
export const CORE_ORDER: StageName[]
export const STAGES: StageEntry[]
export function stageEntry(name: string): StageEntry | undefined

// src/registry/gates.ts
export type Severity = 'block' | 'warn' | 'off'
export interface GateContext { state: UnitState; config: HarnessConfig; unitDir: string; worktree: string | null }
export interface GateOutcome { pass: boolean; remedy?: string }
export interface GateDef { id: string; stage: StageName; description: string; severity: Severity; requires?: string; check: (ctx: GateContext) => GateOutcome | Promise<GateOutcome> }
export interface ResolvedGate { id: string; severity: Severity; status: 'pass' | 'fail' | 'n/a'; remedy?: string; demoted_by?: 'config' | 'mode' | 'kit' }
export function defineGate(def: GateDef): GateDef
export function allGates(): GateDef[]
export function resolveGates(stage: StageName, ctx: GateContext, mode: ModeDef): Promise<ResolvedGate[]>
export function transitionAllowed(gates: ResolvedGate[]): { ok: boolean; blocking: ResolvedGate[]; warnings: ResolvedGate[] }

// src/modes.ts
export interface ModeDef { name: string; extends: string | null; demote: Record<string, Severity>; merge_dispatches: boolean; verify_after_publish: boolean; skip_stages: StageName[]; banner: string | null }
export function resolveMode(name: string, config: HarnessConfig): ModeDef
export function demotionsOf(mode: ModeDef): Array<{ gate: string; to: Severity }>

// src/evidence/kinds.ts
export type EvidenceKind = 'self_critique'|'defect_repro'|'reach_audit'|'screen_verdict'|'impact'|'pii'|'criteria_validation'|'claims'|'waiver'|'browser_findings'|'counterweight'|'review_column'
export const EVIDENCE_KINDS: Record<EvidenceKind, { schema: z.ZodTypeAny; remedy: string; describe: string }>
```

---

## Milestone 0 — Foundation contracts

### Task 1: Project scaffold and hermetic test harness

**Files:** Create `package.json`, `tsconfig.json`, `vitest.config.ts`, `test/setup.ts`,
`test/helpers/tmp.ts`, `test/smoke.test.ts`, `src/index.ts` (exports `VERSION`), `README.md` (title and one-paragraph purpose only), `docs/BUILD_LOG.md`, `docs/BLOCKERS.md`.

**Interfaces:**
- `package.json` scripts: `build` (`tsc -p tsconfig.json`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `check:dist` (Task 35 fills it; for now `node -e "process.exit(0)"`), `gen:tools` (Task 9 fills it).
- `test/helpers/tmp.ts`: `makeTmpDir(prefix: string): string`, `withEnv(vars: Record<string,string>, fn: () => Promise<void>)`.
- `test/setup.ts`: before each test, sets `HARNESS_VAULT` and `HARNESS_CONFIG` to fresh temp paths under `os.tmpdir()`, sets `HARNESS_HOME` to a temp dir that path helpers treat as home. After each, removes them.
- `tsconfig`: `strict`, `module: NodeNext`, `outDir: dist`, `rootDir: src`, `declaration: true`.

**Tests must assert:**
- `VERSION` from `src/index.ts` equals `package.json` version.
- `process.env.HARNESS_VAULT` and `HARNESS_CONFIG` are set during a test and neither starts with `os.homedir()`.
- A test that intentionally reads `os.homedir()` under `HARNESS_HOME` gets the temp dir.

**Done when:** `npm test`, `npm run typecheck`, `npm run build` pass; `dist/index.js` exists and is committed.

- [x] Task 1

### Task 2: Vocabulary lint

**Files:** Create `test/lint/denylist.ts`, `test/lint/vocabulary.test.ts`, `src/lint/scan.ts`.

**Interfaces:**
- `src/lint/scan.ts`: `scanFiles(files: string[], deny: RegExp[], allowMarker: string): Array<{ file: string; line: number; term: string }>`; `collectShipped(root: string): string[]` returning every file under `src/`, `skills/`, `hooks/`, `examples/`, plus `README.md`, excluding `dist/`, `node_modules/`, `docs/`, `test/`.
- `test/lint/denylist.ts`: `DENY: RegExp[]` built case-insensitively from product names (ticket systems, code hosts, chat tools, design tools, review bots, frontend and backend frameworks, dependency bots, monorepo task runners) and the clean-room words `phase`, `orchestrat`, `dev-workflow`, `dev-mcp`. Allow marker is the literal `harness-lint: allow`.

**Tests must assert:**
- `scanFiles` on a fixture file containing a denied term returns one hit with the right line.
- The same term on a line with the allow marker returns zero hits.
- `scanFiles(collectShipped(repoRoot), DENY, marker)` returns `[]` for the real repo.

**Done when:** suite green with zero hits.

- [x] Task 2

### Task 3: Result envelope and brief header contracts

**Files:** Create `src/contracts/envelope.ts`, `src/contracts/header.ts`, `docs/brief-contract.md`, `test/contracts/envelope.test.ts`, `test/contracts/header.test.ts`.

**Interfaces:** as in Shared interfaces. `renderResponse` output is `text`, a blank line, then a fenced ` ```json ` block with the envelope pretty-printed. `renderHeader` emits a fenced ` ```yaml ` block whose first key is `contract: harness-brief/1`.

**Tests must assert:**
- `envelope(true, 's', {a:1})` has `v: 1` and `next: []`.
- `renderResponse` parses back: the fenced json block round-trips to the envelope.
- `HeaderSchema.parse` rejects a header missing `contract` and one with a wrong contract string.
- `renderHeader` output starts with ` ```yaml\ncontract: harness-brief/1` and parses with `yaml`.
- `docs/brief-contract.md` contains every key of `BriefHeader` (test reads the doc and checks each key name appears).

- [x] Task 3

### Task 4: Vault paths and repo namespace

**Files:** Create `src/store/paths.ts`, `src/store/vault.ts`, `test/store/paths.test.ts`, `test/store/vault.test.ts`.

**Interfaces:** as in Shared interfaces, plus `src/store/vault.ts`: `ensureVault(root: string): void` (mkdir and `git init` if `.git` absent, using `child_process.execFileSync('git', ...)`), `ensureUnitDir(vault: string, ns: string, id: string): string` creating `units/<id>/reviews`, `runs`, `drafts`.

**Tests must assert:**
- `homeRelative('/tmp/h/x', '/tmp/h')` is `~/x`; `expandHome('~/x', '/tmp/h')` inverts it; non-home paths pass through unchanged.
- `vaultRoot` prefers `HARNESS_VAULT`, then `storePath`, then `~/.harness/vault` under `HARNESS_HOME`.
- `repoNamespace('git@github.com:o/n.git', 'n')` is `github.com/o/n`; https form gives the same; `repoNamespace(null, 'dir')` is `local/dir`. (The host name in this test file is on an allow-marked line.)
- `ensureVault` on a temp dir creates `.git`; calling twice is idempotent.

- [x] Task 4

### Task 5: Unit state, migrations, history

**Files:** Create `src/store/state.ts`, `src/store/migrations.ts`, `src/store/history.ts`, `test/store/state.test.ts`, `test/store/migrations.test.ts`.

**Interfaces:** as in Shared interfaces. `migrate` accepts `{ schema: 0, id, ... }` fixtures (a synthetic pre-release shape with `phaseName` renamed to `stage`) and returns a valid `UnitState`; unknown schema numbers throw `UnknownSchemaError`. State validated with zod on read and write. `appendHistory` writes `- <ISO timestamp> <line>` to `history.md`.

**Tests must assert:**
- `createState` yields `stage: 'scope'`, `cycle: 0`, `challenge_passed: false`, empty arrays.
- `writeState` then `readState` round-trips; the file contains no absolute home path when `worktree` is set to a path under `HARNESS_HOME`.
- Reading a schema-0 fixture returns schema 1 and rewrites the file to schema 1.
- `appendHistory` appends and preserves earlier lines.

- [x] Task 5

### Task 6: Configuration layers

**Files:** Create `src/config/schema.ts`, `src/config/defaults.ts`, `src/config/load.ts`, `src/config/yaml.ts`, `test/config/load.test.ts`, `test/fixtures/config/*.yaml`.

**Interfaces:** `HarnessConfig` zod schema mirrors spec section 5 exactly, every section optional, `schema` literal `1`. `src/config/yaml.ts`: `parseYamlLocated(text: string, file: string): { value: unknown } | { error: ConfigError }` using `yaml`'s line counter so `line` is filled for parse errors; validation errors carry `path` (dotted), `line` (from the YAML CST node when resolvable, else null), and `valid_keys` (sibling keys allowed at that path, from the zod shape). `loadConfig` order: defaults → kitFragments → user file (`HARNESS_CONFIG` or `HARNESS_HOME/.harness/config.yaml`) → repo file (`<git root of cwd>/.harness.yaml`, found by walking up to a `.git`). A broken layer is skipped and reported; loading never throws.

**Tests must assert:**
- Empty environment and no files yields `DEFAULTS` and `errors: []`.
- Repo list values replace user list values; nested maps merge.
- A user file with `schema: 0` is skipped with an error message mentioning migration.
- A repo file with an unknown key under `repos.x` reports `path: 'repos.x.<key>'` and `valid_keys` containing `base_branch`.
- A YAML syntax error reports a non-null `line`.
- Kit fragments sit below the user layer: user wins on conflict.

- [x] Task 6

### Task 7: Zero-config repo inference

**Files:** Create `src/config/infer.ts`, `src/git/exec.ts`, `test/config/infer.test.ts`, `test/helpers/git.ts`.

**Interfaces:**
- `src/git/exec.ts`: `git(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string }` (sync, never throws), `gitRoot(cwd): string | null`, `remoteUrl(cwd): string | null`, `defaultBranch(cwd): string` (from `origin/HEAD`, else `main` if exists, else `master`, else current).
- `src/config/infer.ts`: `inferProfile(cwd: string): { namespace: string; guesses: Guess[] }` where `Guess = { field: string; value: string; evidence: string }`; fields: `base_branch`, `package_manager`, `commands.install`, `commands.check`, `commands.test`, `commands.lint`, `commands.typecheck`, `commands.e2e`. Readers for `package.json` (scripts + lockfile → npm/yarn/pnpm), `composer.json`, `pyproject.toml`, `go.mod` (+ `Makefile` targets), `Cargo.toml`, bare `Makefile`.
- `test/helpers/git.ts`: `makeRepo(files: Record<string,string>, opts?: { remote?: string; branch?: string }): string` creating a temp git repo with one commit and an optional bare remote.

**Tests must assert:**
- A node repo with `package.json` scripts `test`, `lint`, `typecheck` and a `package-lock.json` infers `package_manager: npm` with evidence naming the lockfile, and each command with evidence naming the script.
- A `pyproject.toml` repo infers `commands.test` containing `pytest` when it is listed as a dependency.
- A repo with no remote yields `namespace` starting `local/`.
- `inferProfile` on an empty temp dir returns zero guesses and does not throw.

- [x] Task 7

### Task 8: Unit ids and ticket patterns

**Files:** Create `src/store/ids.ts`, `src/config/tickets.ts`, `test/store/ids.test.ts`, `test/config/tickets.test.ts`.

**Interfaces:**
- `isTrackerId(s): boolean` (`^[A-Z][A-Z0-9]+-\d+$`), `syntheticId(sourceText): string` (`local-` + first 8 hex of sha256), `unitFromBranch(branch, knownIds?: string[]): string | null` (first tracker-form token, else exact match against known ids), `slugify(title): string`, `branchNameFor(id, title): string` (`<id>-<slug>` trimmed to 60 chars).
- `matchTicket(id, config): TicketRule | null`, `ticketUrl(id, config): string | null`, `statusHint(id, boundary: 'scope'|'build'|'publish'|'close', config): string | null`.

**Tests must assert:** each function on positive and negative inputs; `syntheticId` is stable for equal text and differs for different text; `unitFromBranch('feat/ABC-12-login')` is `ABC-12`; `statusHint` returns null when no rule matches.

- [x] Task 8

### Task 9: Tool registry, dispatch, server, generated inventory

**Files:** Create `src/registry/tools.ts`, `src/registry/index.ts`, `src/tools/system.ts` (actions `version`, `health` only for now), `src/server.ts`, `src/scripts/gen-tools.ts`, `docs/tools.md`, `test/registry/tools.test.ts`, `test/contracts/inventory.test.ts`, `test/server.test.ts`.

**Interfaces:** as in Shared interfaces. `dispatch` validates `input.action` exists (else `ok:false`, summary lists valid actions), then validates with that action's zod schema (else `ok:false`, summary contains the zod issue paths), then calls the handler. `describeTool` renders `<description> Actions: a, b, c.` with the list computed. `server.ts` builds an MCP `Server` over stdio, registers `allTools()` with a merged optional-everything input schema per tool (`action` required enum). `scripts/gen-tools.ts` writes `docs/tools.md` (tool table, then one section per tool listing actions and `describe`). Keep `scripts/` under `src/scripts/` so `tsc` builds it; `npm run gen:tools` is `npm run build && node dist/scripts/gen-tools.js` (no extra dependencies).

**Tests must assert:**
- Unknown action yields `ok: false` and a summary naming the valid actions.
- Invalid params yield `ok: false` with the offending path.
- `system version` returns the package version; `system health` returns `{ vault: 'ok' | 'missing', node: process.version }`.
- `allTools().length` equals the number of files in `src/tools/` (counted at test time).
- `docs/tools.md` equals the generator output (stale doc fails).
- The server lists exactly `allTools().length` tools via the SDK's in-memory transport pair.

- [x] Task 9

### Task 10: Stage registry, gate registry, mode resolution

**Files:** Create `src/registry/stages.ts`, `src/registry/gates.ts`, `src/modes.ts`, `src/stages/_placeholder.ts` (a renderer returning a one-line stub for every stage; replaced by Tasks 11 and 18), `test/registry/stages.test.ts`, `test/registry/gates.test.ts`, `test/modes.test.ts`.

**Interfaces:** as in Shared interfaces. `resolveGates` steps: take gates for `stage`; apply `requires` (missing capability → `n/a`); apply config `gates.<id>.severity`; apply kit override (already merged into config); apply `mode.demote` (only downward: `block→warn→off`, never upward, ignore attempts and note them); append `custom_gates` for the stage as shell-command gates run in `worktree` with a 60s timeout; run `check` for remaining and compute status. Built-in modes: `thorough`, `express`, `sketch` per spec section 8; custom modes from `config.modes` with `extends`.

**Tests must assert:**
- `STAGES` has 20 entries: the 10 core in `CORE_ORDER` plus the 10 flows with `standalone: true`.
- A fake gate with `requires: 'browser_ui'` resolves `n/a` when the capability is false.
- Mode demotion `block → warn` applies; a mode attempting `warn → block` leaves `warn` and `demotionsOf` does not list it.
- `transitionAllowed` is false when any `block` gate fails, true when only `warn` gates fail.
- A custom shell gate `exit 1` fails with its stderr in `remedy`.
- `resolveMode('express')` demotes `reach_audit_recorded` and `counterweight_consulted`; `sketch.skip_stages` contains `review`, `challenge`, `verify`; a custom mode extending `express` inherits its demotions.

- [x] Task 10

## Milestone 1 — Thin pipeline end to end

### Task 11: `unit` tool: start, status, list, brief, explain, advance

**Files:** Create `src/tools/unit.ts`, `src/brief/render.ts`, `src/brief/seats.ts`, `src/stages/{scope,plan,build,commit,review,revise,challenge,verify,publish,close}.ts` (minimal real renderers: heading, purpose sentence, and the `unit brief` follow-up template), `test/tools/unit.test.ts`, `test/contracts/render-empty.test.ts`. Delete `src/stages/_placeholder.ts`.

**Interfaces:**
- `unit start { source: SourceKind; ref?: string; id?: string; mode?: string; text?: string }` → creates state (tracked iff `id` given or source is `ticket`), pins text for `text`/`file`/`conversation` sources into `source.md`, returns `next: [{tool:'unit', action:'brief', why}]`.
- `unit status { id }` → one line: `<id> · <stage> · cycle <n> · <mode> · <branch|no branch>`.
- `unit list {}` → all units in the current namespace.
- `unit brief { id?: string; stage?: StageName | FlowName; quiet?: boolean }` → `renderBrief(ctx)`: header, seat block (`buildSeatBlock(config)` lists each seat with tool names or "unwired — skip steps that need it and say so"), config errors, source/spec block (pinned text or "no pinned source"), then `stageEntry(stage).render(ctx)`. When `quiet` is false append the stop banner `Stop after this stage and report to the user.`
- `unit explain { id }` → next stage, its resolved gates, seats consulted, outputs.
- `unit advance { id; to?: StageName }` → resolves gates for the current stage; refuses with remedies when blocked; otherwise sets `stage`, increments `cycle` when entering `review` from `commit` after a `revise`, starts a timer, appends history.

**Tests must assert:**
- `start` with `source: 'text'` yields an id starting `local-`, `tracked: false`, and `source.md` equal to the text.
- `start` with `id: 'ABC-1'` is tracked.
- `brief` for every entry in `STAGES` renders with empty config and the header parses against `HeaderSchema` (loop over all 20; flows render with `state: null` when `takesNoId`).
- `brief` with `quiet: true` omits the banner; without, includes it.
- `advance` from `scope` to `plan` succeeds with no gates; a fake blocking gate registered in the test makes `advance` return `ok: false` with the remedy.
- `explain` never changes the state file (hash before and after).

- [x] Task 11

### Task 12: `spec` tool: requirement context

**Files:** Create `src/tools/spec.ts`, `src/spec/requirement.ts`, `test/tools/spec.test.ts`.

**Interfaces:**
- `spec record { id; title; body; kind?: UnitKind; url?: string }` → writes `requirement.md` (title, url, body), sets `state.kind` (explicit, else heuristic: `bug` when title or body matches `/\b(bug|defect|regression|broken|crash|error)\b/i`).
- `spec pin { id; text; ref? }` → `source.md`, `source.pinned: true`.
- `spec criteria { id; set?: string[]; }` → numbers criteria `AC-1…`, appends section `## Acceptance criteria` to `requirement.md`; returns `data.criteria: Array<{ id: string; text: string }>`.
- `spec related { id; items: Array<{ kind: 'parent'|'sibling'|'linked'|'pr'; ref: string; title?: string; note?: string }> }` → `related.md`.
- `spec get { id }` → all of the above as data.
- `src/spec/requirement.ts`: `parseRequirement(md): { title; url; body; criteria: Criterion[] }`.

**Tests must assert:** round-trip of record/criteria/related through `get`; bug heuristic sets `kind: 'bug'`; explicit `kind` wins; criteria renumber on re-set.

- [x] Task 12

### Task 13: `exec` tool: command running with logs

**Files:** Create `src/tools/exec.ts`, `src/exec/run.ts`, `test/tools/exec.test.ts`.

**Interfaces:**
- `src/exec/run.ts`: `runCommand(cmd: string, opts: { cwd: string; timeoutMs: number; env?: Record<string,string> }): Promise<{ exit: number; stdout: string; stderr: string; timedOut: boolean }>` via `child_process.spawn` with `shell: true`.
- `exec commands { id }` → profile commands for the unit's repo (merged config, or inferred with `inferred: true` flag and evidence).
- `exec run { id; name?: string; command?: string; timeoutMs?: number }` → runs `commands[name]` or raw `command` in the worktree (or cwd if none), writes full output to `runs/<run-id>.log`, stores `RunRecord` with `summary` = last 20 lines, returns the summary and log path. Exactly one of `name`/`command` required (per-action validation).
- `exec logs { id; run: string; tail?: number }`.

**Tests must assert:** `exec run` with `command: 'echo hi'` records exit 0 and a log containing `hi`; a failing command records its exit code; a `timeoutMs: 100` sleep records `timedOut`; missing both `name` and `command` fails validation with a helpful summary; `exec commands` on a repo with no config returns inferred commands flagged `inferred`.

- [x] Task 13

### Task 14: `vcs` tool: fetch, diff, branch, worktree, commit, cleanup

**Files:** Create `src/tools/vcs.ts`, `src/git/worktree.ts`, `src/git/diff.ts`, `test/tools/vcs.test.ts`.

**Interfaces:**
- `vcs fetch { id }` → `git fetch origin --prune`; result notes whether a remote exists.
- `vcs diff { id; against?: 'base' | 'head'; stat?: boolean }` → always fetches first, diffs against `origin/<base_branch>` (refuses local `<base_branch>` with an explanatory error when the remote exists; falls back to local base only when there is no remote and says so). Returns unified diff (capped at 200 KB with a note) or `--stat`.
- `vcs branch { id; title?: string }` → `branchNameFor`, creates or checks out.
- `vcs worktree { id; title? }` → per capability `isolation`: `worktree` creates `../<repo>-<id>` via `git worktree add`; `branch` just creates the branch in place. Records `state.worktree` and `state.branch`.
- `vcs status { id }` → porcelain status, ahead/behind.
- `vcs commit { id; message: string }` → runs `resolveGates('commit', …)`; if `transitionAllowed` fails, returns remedies and does not commit; otherwise `git add -A && git commit` in the worktree, appends `CommitRecord`, advances stage to `review`.
- `vcs cleanup { id }` → removes the worktree, deletes the local branch if merged, clears `state.worktree`.

**Tests must assert:** (real temp repos with bare remotes) `diff` uses `origin/main` and includes a fetched remote commit; `diff` refuses local-ref comparison when a remote exists; `worktree` creates a sibling directory and records a home-relative path; `commit` is refused when a blocking gate fails and succeeds once evidence exists (register `self_critique` and a green `check` run in the test); `cleanup` removes the worktree.

- [x] Task 14

### Task 15: `evidence` tool and the first real gates

**Files:** Create `src/evidence/kinds.ts`, `src/tools/evidence.ts`, `src/gates/commit.ts` (gates `check_command_green`, `self_critique_recorded`, `defect_repro_before_fix`, `pii_audit_clean`), `src/gates/close.ts` (`pr_recorded`), `src/gates/index.ts` (imports all gate files so `allGates()` is complete), `test/tools/evidence.test.ts`, `test/gates/commit.test.ts`.

**Interfaces:**
- `EVIDENCE_KINDS` schemas: `self_critique { findings: Array<{ severity: 'blocker'|'major'|'minor'|'note'; text: string; addressed: boolean }> }` (empty array valid); `defect_repro { test_location; command; red_output; green_output?: string }`; `waiver { gate: string; rationale: string }`; `pii { findings: Array<{ file; line; sink: 'log'|'storage'|'analytics'|'error_body'|'other'; text }> }`; `reach_audit`, `screen_verdict`, `impact`, `criteria_validation`, `claims`, `browser_findings`, `counterweight`, `review_column` defined per spec sections 8 and 11 (each a concrete zod object; nothing `z.any()`).
- `evidence record { id; kind: EvidenceKind; payload }` → validates against that kind's schema, appends with current `cycle`, returns the remedy text when validation fails.
- `evidence list { id; kind?; cycle? }`, `evidence gates { id; stage? }` (resolved gates with live status), `evidence check { id; gate }`.
- Gate checks: `check_command_green` passes when the latest run named `check` (or `test` if no `check` command) exited 0 in this cycle; `self_critique_recorded` passes when a `self_critique` record exists for this cycle; `defect_repro_before_fix` is `n/a` unless `state.kind === 'bug'`, passes with a `defect_repro` record whose `red_output` is non-empty or a `waiver` for this gate; `pii_audit_clean` passes when a `pii` record for this cycle has zero findings or a waiver exists; `pr_recorded` passes when `state.pr` is set.

**Tests must assert:** each kind accepts a valid payload and rejects an invalid one with its remedy in the summary; an empty `self_critique.findings` passes the gate; the bug gate is `n/a` for `kind: 'feature'` and `fail` for a bug with no record; a waiver flips it to pass; `evidence gates` statuses match `resolveGates` for the same state.

- [x] Task 15

### Task 16: `pullreq` tool: PR bookkeeping, ghostwritten body, worklog

**Files:** Create `src/tools/pullreq.ts`, `src/text/pr-body.ts`, `src/time/worklog.ts`, `test/tools/pullreq.test.ts`, `test/text/pr-body.test.ts`.

**Interfaces:**
- `pullreq body { id }` → `renderPrBody(state, requirement, mode)`: title; summary; `## Scope ledger` table (criterion → proof → status from `criteria_validation` evidence); `## Evidence` (self-critique count, defect repro red/green, pii, impact, reach); `## Waivers` with rationales; `## Not built` (proposed follow-ups from plan.md `## Deferred` section if present); `## Mode` listing every demotion from `demotionsOf(mode)` and, for `sketch`, the banner as the first line of the body; `## Not proven` for reduced modes.
- `pullreq record { id; url; number?; base; head }` → `state.pr`, history line, stops the stage timer.
- `pullreq threads { id; threads: Thread[] }` → replaces `state.pr.threads`.
- `pullreq get { id }`.
- `pullreq worklog { id }` → `suggestWorklog(timers, idleGapMs = 15 min)` returns per-stage minutes with idle gaps subtracted and a total.

**Tests must assert:** body contains every criterion id; sketch body starts with the banner; demotions appear for `express` and not for `thorough`; `record` sets `pr` and `pr_recorded` gate passes; worklog subtracts an idle gap greater than 15 minutes.

- [x] Task 16

### Task 17: `digest` and `recall` tools

**Files:** Create `src/tools/digest.ts`, `src/tools/recall.ts`, `src/store/index.ts` (keyword index), `src/text/handoff.ts`, `src/text/wrapup.ts`, `test/tools/digest.test.ts`, `test/tools/recall.test.ts`.

**Interfaces:**
- `digest write { id; summary; decisions: string[]; tags?: string[] }` → `digest.md` in the unit dir and updates `index/digests.json` (`{ id, repo, summary, decisions, tags, tokens: string[] }`).
- `digest get { id }`, `digest history { id; line?: string }` (append when `line` given, else return history).
- `digest handoff { id }` → `renderHandoff(state, requirement, digest)`: where things stand, open questions, next action; saved to `drafts/handoff.md` and returned.
- `digest wrapup { id }` → `renderWrapup(state, requirement, mode)`: PR link, stage table from `timers` and `commits`, scope ledger, not-built list, held drafts (files in `drafts/`), and `## Not proven` for reduced modes.
- `recall search { query; repo?; limit? }` → tokenized keyword match with a simple score (term overlap), returns top hits; `recall reindex {}` rebuilds from all `digest.md` files.

**Tests must assert:** write then search finds the unit by a decision keyword; reindex after deleting the index restores it; wrapup lists every stage that has a timer; handoff is saved under `drafts/`.

- [x] Task 17

### Task 18: Shared prose and the ten core stage skills

**Files:** Create `skills/_shared/{style,scope-rules,severity,subagent-etiquette,standing-rules}.md`, `skills/<stage>/SKILL.md` for the ten core stages, `src/skills/inspect.ts` (`listSkills(root)`, `parseFrontmatter`, `extractRootRefs`, `extractToolCalls`), `test/contracts/skills.test.ts`. Flesh out the ten stage renderers in `src/stages/*.ts` with the stage-specific material from spec section 7 and blueprint B5 (requirement + criteria, plan, latest review, repo commands, prior decisions via `recall search`, tool-call templates with ids filled in).

**Interfaces:**
- Frontmatter per skill: `name`, `description`, `stage` (or `flow`), `argument-hint: "<source> [id] [mode]"` for entry skills.
- First instruction in every stage skill: call `unit brief` with `stage: <name>` and the id. Shared prose is referenced as `@root/skills/_shared/<file>.md`, never inlined.
- `standing-rules.md` holds exactly the four rules from blueprint B9 (scope, cross-check, remote refs, no posting without approval) plus the seat rule (unwired seat → skip and say so).
- `severity.md` defines blocker/major/minor/note used by every evidence kind.

**Tests must assert:** every `skills/*/SKILL.md` has the required frontmatter keys; every `@root/` reference resolves to an existing file; every tool and action name mentioned in a fenced call template exists in the registry; each core stage skill's first call template is `unit brief`; no skill inlines the text of a `_shared` file (check a distinctive sentence from each shared file appears only in that file).

- [x] Task 18

### Task 19: `pilot` flow: route, report, answer, reconcile

**Files:** Create `src/flows/pilot.ts` (brief renderer), `src/pilot/route.ts`, `src/pilot/reconcile.ts`, `skills/pilot/SKILL.md`, extend `src/tools/unit.ts` with `report`, `route`, `answer`, `reconcile`, `test/pilot/route.test.ts`, `test/pilot/reconcile.test.ts`.

**Interfaces:**
- `unit report { id; stage; outcome: 'done'|'blocked'|'failed'; summary; questions?: string[]; verdict?: 'ship'|'needs_attention'|'not_ready'; artifacts?: Record<string,string> }` → stored under `state.reports[stage][cycle]` (add `reports: Record<string, Report[]>` to `UnitState` with a migration step and bump nothing: schema stays 1 because the field is optional-with-default).
- `unit route { id }` → `routeNext(state, mode): { next: StageName | null; decision: 'proceed'|'retry'|'blocked'|'done'; verdict?; questions: string[] }`. Rules: follow `CORE_ORDER` skipping `mode.skip_stages` and `verify` when `browser_ui` is false; after `review` with verdict `needs_attention` or `not_ready` → `revise` (retry) while `cycle < 4`, else `blocked`; after `review` with `ship` and `challenge_passed` false → `challenge`; `challenge` passed → `verify` or `publish` per capability and `mode.verify_after_publish`; `close` done → `done`; any report `blocked` → `blocked` with its questions; last report `failed` for `commit` → `retry` up to 2 times then `blocked`.
- `unit answer { id; answers: Record<string,string> }` → merges into `state.answers`, history line.
- `unit reconcile { id; live: { branch?: string; uncommitted?: boolean; pr_state?: 'open'|'merged'|'closed'|'none'; tracker_status?: string } }` → `reconcile(state, live)` returns disagreements (`branch differs`, `uncommitted work while stage is review`, `pr merged while stage is publish`, etc.) without mutating state; the assistant supplies `live` from its own tools.
- Pilot brief: dispatch template per stage (read `@root/skills/<stage>/SKILL.md`, call `unit brief` with `quiet: true`, follow every step, finish with `unit report`), the standing-rules pointer, the route call, checkpoint rules.

**Tests must assert:** a table of `(state, mode) → route` cases covering every rule above, including express `verify_after_publish` ordering and sketch skipping straight from `commit` to `publish`; `reconcile` reports each disagreement kind and reports none for a consistent pair; `report` persists and `route` reads it.

- [x] Task 19

## Milestone 2 — Quality machinery

### Task 20: `analyze` tool: impact, pii, claims, reach, criteria map

**Files:** Create `src/analysis/{diff-parse,impact,pii,claims,reach,criteria-map}.ts`, `src/tools/analyze.ts`, `src/gates/review.ts` (`impact_recorded`, `reach_audit_recorded`), `src/gates/publish.ts` (`criteria_validated`, `claims_audited`), `test/analysis/*.test.ts`, `test/tools/analyze.test.ts`.

**Interfaces:**
- `parseDiff(unified: string): Hunkfile[]` with `{ path, added: Array<{ line: number; text: string }>, removed, isNew }`.
- `impactRadius(diff, worktree): { changed_exports: Array<{ file; name }>; consumers: Array<{ file; imports: string[] }> }` by regex over `import|require|use|from` statements across the worktree (respecting `.gitignore` via `git ls-files`).
- `piiAudit(diff): PiiFinding[]` flags added lines that both mention an identity-shaped value (`email`, `phone`, `ssn`, `address`, `name`, `dob`, `token`, `password`, or an email-literal regex) and flow into a sink (`console.`, `log`, `logger`, `analytics`, `track(`, `localStorage`, `INSERT`, `res.status(4|5xx).json`, `throw new Error(`…`${`).
- `claimsAudit(text): Claim[]` extracts sentences with assertive verbs (`fixes`, `ensures`, `always`, `never`, `no longer`, `handles`, `covers`) and returns `{ text; needs: 'test' | 'run' | 'screenshot' | 'link' }`.
- `reachAudit(diff, subjects: { e2e_globs: string[]; mock_globs: string[]; contract_globs: string[] }, worktree): Array<{ surface: string; kind: 'file'|'export'|'route'; covered_by: string[] }>` where `surface` is each new file/export/route (`app.get(`, `router.`, `@Route`, `path:` literals) and `covered_by` is the subject files that mention it.
- `criteriaMap(criteria, diff): { unproven: Criterion[]; orphan_hunks: Hunkfile[] }` using keyword overlap between criterion text and hunk text or file path.
- Tool actions `analyze impact|pii|claims|reach|criteria_map { id; diff?: string; text?: string }` compute and also `evidence record` the result of the matching kind, returning `next` pointing at the relevant gate.
- Gates: `impact_recorded` (warn) passes with an `impact` record this cycle; `reach_audit_recorded` (block) passes with a `reach_audit` record whose every surface has `covered_by.length > 0` or an explicit `waived: true` with reason; `criteria_validated` passes when a `criteria_validation` record covers every `AC-n`; `claims_audited` passes when a `claims` record exists this cycle.

**Tests must assert:** each analyzer on small fixture diffs (a new export with one importer; an added `console.log(user.email)`; a PR body sentence "This always retries"; a new route not mentioned by any e2e spec; a criterion with no matching hunk); gate pass/fail flips with the records.

- [x] Task 20

### Task 21: `diffaudit` tool, review columns, synthesis, challenge

**Files:** Create `src/review/columns.ts`, `src/review/synthesize.ts`, `src/diffaudit/rules.ts`, `src/tools/diffaudit.ts`, extend `src/tools/evidence.ts` with `synthesize`, `src/gates/challenge.ts` (`review_verdict_ship`, `challenge_passed`), `test/review/synthesize.test.ts`, `test/tools/diffaudit.test.ts`.

**Interfaces:**
- `Rule = { id; pattern: string; files: string; severity: 'blocker'|'major'|'minor'|'note'; message: string }`; `loadRules(config): Rule[]` from `config.diffaudit.rules` (add `diffaudit: { rules: Rule[] }` to the schema) merged with kit rules; `runRules(rules, diff): Finding[]` matching `pattern` against added lines in files matching the glob.
- `diffaudit run { id; diff? }` → findings, recorded as a `review_column` with `column: 'diffaudit'`; `diffaudit rules { id }`.
- `REVIEW_COLUMNS` constant per spec section 8 with `requires` for `component_library`, `accessibility`, `counterweight`, `browser`.
- `synthesize(columns: ReviewColumnRecord[], required: string[]): { verdict; counts; missing_columns: string[] }`: verdict `not_ready` if any blocker or any required column missing, `needs_attention` if any major, else `ship`.
- `evidence synthesize { id }` → writes `reviews/cycle-<n>.json`, stores `state.reviews[cycle] = verdict`, returns the verdict.
- Gates: `review_verdict_ship` (challenge stage) passes when the current cycle's synthesized verdict is `ship`; `challenge_passed` (publish stage) passes when `state.challenge_passed` is true; `unit report` for stage `challenge` with `verdict: 'ship'` sets `challenge_passed = true` (sticky; later cycles do not reset it).

**Tests must assert:** a rule fixture hits an added line and not a removed one; synthesis verdict table (blocker → not_ready; missing required column → not_ready; major only → needs_attention; minors → ship); `challenge_passed` stays true after a subsequent `revise` cycle.

- [x] Task 21

### Task 22: `ledger` tool and re-verification

**Files:** Create `src/tools/ledger.ts`, `src/store/ledger.ts`, `src/gates/ledger.ts` (`ledger_reverified`, warn), `test/tools/ledger.test.ts`. Extend `scope` and `review` renderers to print the open ledger entries for the repo.

**Interfaces:** `LedgerEntry = { id; repo; kind: 'ask' | 'landing'; text; origin_unit; created_at; status: 'open' | 'rechecked' | 'closed'; last_checked_unit?: string }`. `ledger add { repo?; kind; text; id? }`, `ledger list { repo?; status? }`, `ledger recheck { entry; id; note? }` (marks `rechecked` for this unit, appends note), `ledger close { entry; reason }`. Gate passes when every open entry has `last_checked_unit === state.id` or the ledger is empty.

**Tests must assert:** add then list; recheck flips the gate for that unit only; closed entries do not block; the review brief includes an open entry's text.

- [x] Task 22

### Task 23: Counterweight resolution and convergence

**Files:** Create `src/review/counterweight.ts`, `src/gates/counterweight.ts` (`counterweight_consulted`, warn, `requires: 'seat:counterweight'`), `test/review/counterweight.test.ts`.

**Interfaces:**
- `resolveCounterweight(config, env, deps: { fetch?: typeof fetch; exec?: typeof runCommand }): Provider` with `Provider = { kind: 'cli' | 'http' | 'fallback-stub'; describe(): string; review(prompt: string): Promise<string> }`. Order: `seats.counterweight.cli` set → CLI; `seats.counterweight.http` set and `COUNTERWEIGHT_API_KEY` present in the dotenv → HTTP via injected `fetch`; else stub that returns a fixed text declaring `provider: fallback-stub`.
- `loadDotenv(path): Record<string,string>` in `src/config/dotenv.ts` (no dependency; `KEY=value` lines, quotes stripped).
- `trackFindings(previous: CounterweightRecord[], current: Finding[], cap = 3): { active: Finding[]; capped: Array<{ class: string; count: number }> }` where `class` is `severity + ':' + first three words normalized`.
- `requires: 'seat:<name>'` support in `resolveGates`: `n/a` when the seat has no tools and no cli/http configured.

**Tests must assert:** resolution order with each configuration; the http provider calls the injected fetch and never the global one; the stub's text contains `fallback-stub`; a finding class seen four times is reported in `capped` and excluded from `active`; gate is `n/a` when unwired.

- [x] Task 23

### Task 24: Run modes wired through brief, route, and PR body

**Files:** Extend `src/brief/render.ts` (header `mode` and a `## Mode` block listing demotions and skipped stages), `src/pilot/route.ts` (already reads `mode`; add merged-dispatch hint in the pilot brief for `express`), `src/tools/unit.ts` (`start` validates `mode` against built-ins plus `config.modes`), `skills/<stage>/modes/{express,sketch}.md` for `build`, `review`, `publish` (stage skills say: "if the header mode is X, also read `@root/skills/<stage>/modes/X.md`"), `test/modes.integration.test.ts`.

**Tests must assert:** `unit start` with an unknown mode fails validation naming the known modes; a custom mode from config is accepted; the express brief lists its two demotions; the sketch brief for `build` says nothing will review the diff; the mode files exist for exactly the stages the skills reference (skills contract test extended).

- [x] Task 24

### Task 25: `verify` stage: browser validation brief and gate

**Files:** Extend `src/stages/verify.ts`, `skills/verify/SKILL.md`, create `src/config/environments.ts` (`selectEnvironment(config, role): Environment | null`, `credentialsFor(env, dotenv): Record<string,string>` by prefix), `src/gates/verify.ts` (`walkthrough_done`, block, `requires: 'browser_ui'`), `test/stages/verify.test.ts`.

**Interfaces:** The brief lists each acceptance criterion with the edge cases the assistant must derive, the environment chosen by role `sut` (URL only, credentials named by env var, never their values), the reference environment for reproducing runtime errors, the e2e command from the profile, the instruction to attach annotated screenshots via the codehost seat's `attach` tools (or skip and say so), and the scope rule: out-of-scope observations go into `browser_findings.out_of_scope` and cannot affect the verdict. `browser_findings` schema: `{ criteria: Array<{ id; result: 'pass'|'fail'|'blocked'; notes; screenshots: string[] }>; runtime_errors: string[]; e2e: { command; exit } | null; out_of_scope: string[] }`. Gate passes when a `browser_findings` record this cycle has every criterion `pass`.

**Tests must assert:** `selectEnvironment` picks by role regardless of name order; credentials resolve by prefix and never appear in the brief text; the gate is `n/a` without `browser_ui`, fails with a `fail` criterion, passes when all pass; `out_of_scope` content does not change the gate.

- [x] Task 25

### Task 26: Safety hooks with loud failure

**Files:** Create `hooks/hooks.json`, `hooks/guard.mjs`, `src/hooks/{index,adapter,guards,resolve-unit}.ts`, `test/hooks/guards.test.ts`, `test/hooks/bootstrap.test.ts`.

**Interfaces:**
- `hooks.json`: `PreToolUse` matcher `Bash` → `node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs" pre-bash`; `Stop` → `… stop_status`.
- `guard.mjs`: reads stdin JSON, `import('../dist/hooks/index.js')` (path overridable by `HARNESS_HOOK_IMPL` for tests); on import failure: if the command matches `/\bgit\s+(commit|push)\b/` or a PR-creation shape (`pr create`, `pull-request`, `merge-request`), print a block decision with `npm install && npm run build` instructions and exit 2; else print a warning line and exit 0.
- `src/hooks/adapter.ts`: `parseHostPayload(json): { event: 'pre-bash' | 'stop'; command?: string; cwd: string }`; `decision(block: boolean, message: string)` writes the host's expected JSON.
- `src/hooks/guards.ts`: `runPreBash(payload, deps)` runs in order `no_bypass_flags` (`--no-verify`, `--no-gpg-sign` on commit, `--force` without `--force-with-lease` on push), `protected_branch` (push to any `config.protected_branches` glob unless `HARNESS_ALLOW_PROTECTED=1` or the command contains `# harness: allow-protected`), `credential_scan` over `git diff --cached` (key-shaped tokens: long base64/hex with `key|secret|token|password` nearby, PEM headers), `oversize_file` (> 5 MB staged), `pii_sink_warn` (uses `piiAudit`, warn only), `commit_gate` (resolves commit gates for the unit from the branch), `publish_gate` (publish gates on push/PR create), `transition_preview` (prints the next stage's gates when the command is a `unit advance` call shape). `resolveUnit(cwd, vault): UnitState | null` via `unitFromBranch(currentBranch, knownIds)`; null → all guards silent except `no_bypass_flags` and `credential_scan`.
- `stop_status` prints `unit status` for the resolved unit.

**Tests must assert:** each guard blocks/passes on a representative command (temp repo with a staged secret, a staged 6 MB file, a branch named `ABC-1-x` with failing commit gates, `--no-verify`); no unit on branch → commit gate silent; bootstrap with `HARNESS_HOOK_IMPL` pointing at a missing file blocks `git commit` with exit 2 and passes `ls` with a warning (spawn `node hooks/guard.mjs` in the test).

- [ ] Task 26

## Milestone 3 — Standalone flows

### Task 27: `screen` and `shape` flows with verdict consensus

**Files:** Create `src/flows/screen.ts`, `src/flows/shape.ts`, `src/review/consensus.ts`, `skills/screen/SKILL.md`, `skills/shape/SKILL.md`, `test/flows/screen.test.ts`.

**Interfaces:** `screen_verdict` payload: `{ dimension: 'technical' | 'product'; model: 'primary' | 'second'; verdict: 'valid' | 'invalid' | 'unclear'; reasons: string[] }`. `consensus(records): { verdict; agreement: number; dissent: string[] }` where unanimous → that verdict, any `invalid` with a `valid` → `unclear`, and missing `second` records are noted. The screen brief asks for four structured calls (2 dimensions × 2 models; the second model via the counterweight provider) then `evidence record` each, then reports the consensus and a suggested tracker status hint from `statusHint(id, 'scope')`. The shape brief checks story readiness: criteria present and testable, links resolved, ambiguities listed, and produces a ghostwritten clarification question saved to `drafts/clarify.md`.

**Tests must assert:** consensus table; the screen brief lists four calls; shape brief on a unit without criteria says so and drafts the question file.

- [ ] Task 27

### Task 28: `inspect`, `respond`, `aftercare` flows

**Files:** Create `src/flows/{inspect,respond,aftercare}.ts`, corresponding `skills/*/SKILL.md`, `src/text/replies.ts`, `test/flows/pr-flows.test.ts`.

**Interfaces:** `inspect` takes a PR ref (`takesNoId: true`), creates a unit `pr-<number>` in the current namespace with `source.kind: 'pr'`, runs the review columns read-only, synthesizes, and never records evidence beyond `review_column` (the brief states this). `respond` reads `state.pr.threads`, groups by file, instructs one batched commit per round, drafts a reply per thread via `renderReplies(threads, decisions)` into `drafts/replies.md`, and lists which threads to resolve on the host. `aftercare` triages follow-up comments on a shipped unit into `fix now | new ticket | reply only`, drafting text for each.

**Tests must assert:** inspect creates a `pr-…` unit and its brief contains "read-only"; respond groups threads by path and writes the drafts file; aftercare classification renders all three buckets.

- [ ] Task 28

### Task 29: `botprs` and `draft` flows

**Files:** Create `src/flows/{botprs,draft}.ts`, `skills/botprs/SKILL.md`, `skills/draft/SKILL.md`, `src/text/ticket.ts`, `test/flows/misc-flows.test.ts`.

**Interfaces:** `botprs` (takes no id) instructs the assistant to list open bot-authored PRs with its codehost tools, then classify each as `auto-merge | needs-review | hold` using semver bump and lockfile-only heuristics provided in the brief, recording a `digest write` per batch. `draft` turns a plain-language request into a ticket: `renderTicket({ title, context, criteria, out_of_scope })` saved to `drafts/ticket.md`, with the tracker seat's create tool named if wired, and the instruction to file only after approval.

**Tests must assert:** both briefs render with empty config; `renderTicket` numbers criteria `AC-n`; the botprs brief says "skip and say so" when the codehost seat is unwired.

- [ ] Task 29

### Task 30: `reviewbot` tool and post-publish loop

**Files:** Create `src/tools/reviewbot.ts`, extend `src/pilot/route.ts` and the pilot brief, `test/tools/reviewbot.test.ts`.

**Interfaces:** `reviewbot ready { id }` → returns the suggested codehost call to mark the PR ready and records `state.bot = { round: 0, status: 'pending' }` (add optional `bot` to state). `reviewbot poll { id; status: 'pending' | 'passed' | 'changes_requested' | 'failed'; polls?: number }` → records; the brief instructs at most 10 polls 30 s apart. `reviewbot threads { id; threads: Thread[] }` → stores bot threads separately in `state.bot.threads`. `reviewbot round { id }` → increments; when `round > 2` returns `decision: 'defer_to_human'`. Route: after `publish` with the seat wired and `bot.status === 'changes_requested'` and `round <= 2` → `next: 'respond'`; otherwise → `close`.

**Tests must assert:** round cap; route table additions; unwired seat → route goes straight to `close`.

- [ ] Task 30

### Task 31: `convoy` flow

**Files:** Create `src/flows/convoy.ts`, `src/pilot/cluster.ts`, `skills/convoy/SKILL.md`, extend `unit` with `link { id; related: string[] }`, `test/pilot/cluster.test.ts`.

**Interfaces:** `predictFiles(plan: string): string[]` extracts file paths from `plan.md` (backticked paths and `Files:` lines). `cluster(units: Array<{ id; files: string[] }>): string[][]` groups by Jaccard overlap ≥ 0.2 (union-find). The convoy brief: run `scope` and `plan` for each id, cluster, present the grouping for approval, then pilot groups sequentially, calling `unit link` so each state lists its convoy siblings.

**Tests must assert:** clustering on three fixtures where two overlap; `link` persists symmetrically; the brief contains the approval checkpoint.

- [ ] Task 31

## Milestone 4 — Kits, doctor, setup, distribution

### Task 32: Kits: discovery, merge, doc selection, rules, example kit

**Files:** Create `src/kits/{discover,manifest,select}.ts`, `examples/kits/web-ui/kit.yaml`, `examples/kits/web-ui/docs/ui-conventions.md`, `examples/kits/web-ui/rules.yaml`, extend `loadConfig` to accept discovered kits, `system kits` action, `test/kits/kits.test.ts`.

**Interfaces:** `discoverKits(names: string[], env, home, pluginRoot): Kit[]` searching `HARNESS_KIT_PATHS`, `~/.harness/kits`, `<pluginRoot>/../../cache/*/kits` (plugin manager cache), `<pluginRoot>/../ai-coding-harness-kits/kits`, first hit wins; `Kit = { name; dir; fragment: Partial<HarnessConfig>; docs: Array<{ path; tags: string[]; capabilities: string[] }>; rules: Rule[] }`. `selectDocs(kits, profile): string[]` returns absolute paths of docs whose tags intersect `profile.tags` or whose capabilities are truthy in `profile.capabilities`; these populate the header `docs` field. The example kit: one doc selected by `browser_ui`, two rules (hardcoded hex color in a style file; `any` in a type position), one gate override (`walkthrough_done: block`).

**Tests must assert:** discovery order via two temp kit dirs with the same name; the example kit loads via `HARNESS_KIT_PATHS`; doc selection by capability and by tag; user config overrides a kit gate override; `system kits` lists the loaded kit; core still renders every stage with `kits: []`.

- [ ] Task 32

### Task 33: `system` tool: doctor, config, infer, sync, tokens

**Files:** Extend `src/tools/system.ts`, create `src/system/{doctor,tokens,sync}.ts`, `test/tools/system.test.ts`.

**Interfaces:** `system doctor {}` → read-only report: inferred profile with evidence, config layers with provenance and errors, seats wired/unwired, kits loaded, environments, vault health (exists, git, remote), build health (`dist/` present and its `VERSION` matches), plus `proposed_repo_config: string` (YAML rendered from inference). `system config { mode: 'merged' | 'propose' | 'write'; yaml?: string }`: `merged` shows the effective config with a provenance map (`key → layer`); `propose` returns the doctor's proposal; `write` writes `.harness.yaml` at the git root only when `yaml` is supplied (the assistant passes back the approved text) and refuses to overwrite an existing file without `overwrite: true`. `system infer {}` exposes `inferProfile`. `system sync {}` per spec section 4. `system tokens { mode? }` → sums bytes and an estimated token count (bytes/4) of every skill file, shared file, mode file, and a rendered brief for each stage in `CORE_ORDER` for a fixture unit, grouped by stage.

**Tests must assert:** doctor on a temp node repo lists the inferred commands with evidence and proposes YAML that parses and validates; `config write` refuses overwrite without the flag; `sync` without a remote says skipped; `tokens` returns a per-stage table whose total equals the sum.

- [ ] Task 33

### Task 34: `setup` flow

**Files:** Create `src/flows/setup.ts`, `src/setup/seat-heuristics.ts`, `skills/setup/SKILL.md`, `test/flows/setup.test.ts`.

**Interfaces:** `mapToolsToSeats(toolNames: string[]): Record<SeatName, string[]>` using name heuristics (each product-name regex on an allow-marked line) plus generic words (`ticket`, `issue`, `pull`, `pr`, `review`, `wiki`, `page`, `design`, `frame`, `chat`, `message`). The setup brief: call `system doctor`; list the session's visible tool names and paste them into `mapToolsToSeats` via a tool call (`system seats { tools: string[] }`, add this action); ask about reviewbot, counterweight, kits, environments; show the proposal; call `system config { mode: 'write' }` only after confirmation.

**Tests must assert:** heuristics map a set of fake tool names to the right seats and leave unknowns unmapped; the brief ends with the confirmation instruction; vocabulary lint remains zero (allow marks in place).

- [ ] Task 34

### Task 35: Plugin packaging and dist freshness

**Files:** Create `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.mcp.json`, `src/scripts/check-dist.ts`, extend `README.md` (install, zero-config quick start, seats, modes, kits, hooks, config reference pointer), `test/contracts/plugin.test.ts`.

**Interfaces:** `plugin.json` declares `name: harness`, `version` equal to `package.json`, explicit `skills` (every `skills/*/SKILL.md`), `hooks: ./hooks/hooks.json`, `mcpServers.harness` → `node ${CLAUDE_PLUGIN_ROOT}/dist/server.js`. `marketplace.json` lists the single plugin at `./`. `check:dist` builds to a temp dir and diffs against `dist/`, exiting non-zero on any difference.

**Tests must assert:** plugin version equals package version and `VERSION`; every skill dir is declared and every declared skill exists; hooks path and server path exist; `.mcp.json` server command references `dist/server.js`; `README.md` mentions every tool name.

- [ ] Task 35

### Task 36: Token economy pass

**Files:** Edit skill files and renderers as needed; create `docs/token-budget.md`.

**Interfaces:** Run `system tokens` for `thorough`; record the per-stage table in `docs/token-budget.md`. Apply the blueprint's B5 techniques where a stage exceeds 4,000 estimated tokens: move rarely-needed material into `skills/<stage>/reference.md` appendices loaded on demand, ensure no shared prose is duplicated, keep mode sections in their files. Re-measure and record before/after.

**Tests must assert:** a contract test reads `docs/token-budget.md` and asserts the recorded total is within 10% of a live `system tokens` run (so the doc cannot go stale); every stage brief plus skill stays under 6,000 estimated tokens.

- [ ] Task 36

## Milestone 5 — Final audit

### Task 37: Final audit and release readiness

**Files:** Create `CHANGELOG.md`, `docs/BUILD_LOG.md` closing summary; edit `README.md` if anything is missing.

**Checklist (all must be true, verified by running, output pasted into the build log):**
- `npm run typecheck`, `npm test`, `npm run build`, `npm run check:dist`, `npm run gen:tools` then `git status --porcelain` empty.
- Vocabulary lint zero. Every stage renders on empty config. Skills contract green. Plugin contract green.
- `docs/tools.md`, `docs/brief-contract.md`, `docs/token-budget.md` current.
- `docs/BLOCKERS.md` reviewed: every `[!]` task retried once more; remaining entries carry a reason and a suggested path.
- `CHANGELOG.md` has a `0.1.0` section summarizing tools, stages, flows, gates, hooks, kits.
- `git tag v0.1.0` created locally. Nothing pushed.
- Final line appended to `docs/BUILD_LOG.md`: `BUILD COMPLETE <date> · tests <n> · tools 13 · stages 10 · flows 10 · gates <n> · tokens <total>`.

- [ ] Task 37
