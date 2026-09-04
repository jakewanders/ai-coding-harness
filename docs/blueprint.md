# Blueprint: a tracker-driven development lifecycle engine

This is a functional blueprint for building, from scratch, an agent-assisted development
pipeline: an MCP server paired with a set of agent instruction files that walk a coding
assistant from "here is a ticket" to "here is a merged-ready pull request," with quality
enforcement that does not depend on the model remembering to be careful.

It intentionally describes *behavior and architecture only*. Do not copy any prose,
identifiers, command names, or file layouts from any existing implementation — invent your
own voice, your own vocabulary, and your own structure. Where this document uses a working
name (in **bold** on first use), treat it as a placeholder you are encouraged to rename.
A suggested-vocabulary appendix sits at the end; picking entirely different words is fine.

---

## 1. Mission

One assistant session, given a unit of work (a ticket id, a spec document, a URL, or a
plain-language request), should be able to:

1. understand the requirement and its surrounding context,
2. build it in an isolated checkout,
3. subject the result to layered, adversarial quality review,
4. open a well-documented pull request,
5. and leave behind a durable, searchable record of what happened and why —

while a deterministic server enforces the parts that must not be left to model judgment:
ordering, evidence, and safety rails.

The product is installable as a single editor/CLI plugin, works on any machine after a
clone-and-install, and knows nothing about any specific company, vendor, framework, or
team ritual.

## 2. The one load-bearing design decision

**The engine never talks to the outside world.** It holds no API clients, no tokens for
ticket systems or code hosts, and it never posts anything anywhere. Every interaction with
an external system — fetching a ticket, opening a PR, reading review threads, posting a
comment — is performed by the *assistant* using whatever tools its own session already has
(MCP tools, CLIs). The engine's role is threefold:

- **Bookkeeper.** The assistant hands it normalized results ("here is the ticket I
  fetched," "here is the PR I opened," "here are the reviewer threads"), and it persists
  them so later steps, gates, and resumed sessions can rely on them.
- **Ghostwriter.** Anything that used to be "the server posts X" becomes "the server
  returns the finished text of X" — handoff notes, status summaries, clarification
  questions, PR evidence bodies — and the assistant posts it with its own tools, after
  human approval whenever the text addresses a person.
- **Gatekeeper.** Stage transitions are refused until required evidence exists.

Configuration therefore names **capability roles**, not products: a *tracker* role, a
*code-host* role, a *docs* role, a *design* role, a *chat* role, a *review-bot* role, and
a *second-opinion-model* role. Each role's config lists the tool names the assistant
should call for each operation, or is left empty. Every rendered instruction begins with a
role wiring summary: which roles this stage consults, which tool serves each, and — for
unwired roles — an explicit "skip this step and say so."

A CI-enforced lint keeps this honest: a test scans every shipped file for a deny-list of
product names and team jargon and fails on any hit outside explicitly marked
compatibility lines. Write that test on day one.

## 3. Domain model

- **Work unit.** The thing being built. Identified by an opaque slug (a tracker id like
  `ABC-123`, a hand-chosen name, or a synthesized id for tracker-less runs). Ids are the
  universal lookup handle; nothing derives meaning from their shape beyond recognizing the
  classic `PREFIX-number` form for URL templates and branch-name matching.
- **Source.** Where the requirement text comes from: the tracker item itself, a PR URL, an
  arbitrary hyperlink, a local document (md/txt/html/pdf), the current conversation, or
  freeform text. Any entry command accepts `<source> [id] [mode]`. A keyless source runs
  **untracked**: a stable synthetic id is derived, requirement context is synthesized from
  the source text, no tracker writes ever occur. Pairing a source with an id keeps the run
  tracker-attached while the supplied document remains the authoritative requirement; its
  text is pinned verbatim into the work unit's records so every later stage and every
  subagent reads the identical spec.
- **Stage.** One step of the pipeline. Core sequence:
  `recon → plan → build → commit → review → [patch → commit → review]* → red-team →
  browser-check? → pull-request → sweep`. Each stage has an agent instruction file (the
  static half) and a server-rendered context (the dynamic half).
- **Standalone flows** live outside the state machine: pre-work validity triage of a
  ticket, story-readiness review, full-pipeline conduction, multi-ticket batching,
  side-effect-free review of an arbitrary PR, addressing PR feedback, triaging follow-up
  comments on a shipped item, classifying dependency-bot PRs, drafting and filing a new
  ticket, and first-run setup.
- **Repo profile.** Per-repository facts the engine may rely on: default base branch, an
  open map of command strings (verify, test, lint, typecheck, e2e, boot), constraints
  (package manager, extra test flags), monorepo sub-project profiles, free-form tags, and
  **capabilities** — declared abilities such as: isolation style (fresh worktree vs.
  feature branch in the main checkout), an install command, a daemon warm-up command, a
  browser-testable UI, a published inter-module contract, a mandated component library.
  Capability names are an open set so add-on packs can define their own. Code paths key
  off capabilities and roles, never off framework names or tag spellings.
- **Environment.** A named deployed target with a URL, a functional role
  (system-under-test / reference / production), and env-var prefixes for credentials.
  Logic selects environments by role only; names carry no meaning.
- **Run mode.** A named preset that trades breadth for speed: the full pipeline; a
  thinned variant (merged dispatches, some gates demoted to advisory, browser checking
  moved after the PR); and a prototyping variant (a single subagent carries the ticket
  straight through to a commit, nothing reviews the diff, and the resulting PR loudly
  declares that fact). Users can define custom
  modes in config by extending a built-in and overriding its knobs. Modes may only ever
  *demote* gates, never invent stricter ones silently — and every demotion is named in the
  PR description so a fast run admits what it did not prove.

## 4. Persistence: the record store

All state lives in one local directory (git-initialized) whose location is configurable:

- Per work unit: a state file (schema-versioned), the pinned source, the normalized
  requirement context, related-PR context, the plan, per-cycle review reports, commit
  records, run outputs (full logs on disk, compact summaries in state), drafted outbound
  posts, and a running human-readable history log.
- Cross-unit: a keyword index over story summaries (for "have we decided this before?"
  lookups), and a per-repository **carry-forward ledger** — standing asks and past
  landings that outlive any single ticket, so deferred work is re-verified on the next
  ticket instead of forgotten.

Portability requirements, learned the hard way — build them in from the start:

- Namespace unit directories by repository (mirroring how the ledger is keyed).
- Never persist machine-absolute paths: serialize home-relative, expand on read.
- Schema-version the state file and migrate old shapes on read, transparently.
- Support an optional git remote for the store so state follows the user across machines;
  without one, sync operations report themselves skipped rather than pretending.
- Keep the test suite hermetic: tests must stub the store path and never touch the real
  one.

## 5. The dynamic/static split for instructions

Each stage's instructions come in two halves:

- A **static skill file** per stage: the procedure, the rules, the tool-call recipes.
  Shared prose (writing style, scope rules, severity rubric, subagent etiquette) lives in
  a shared directory and is referenced, not duplicated. All cross-file references resolve
  against the *plugin's install root*, never the user's working directory — establish a
  single notation for that and use it everywhere, because subagents are spawned with
  arbitrary cwds.
- A **rendered context** the skill requests as its first action, via one server call. It
  returns: a machine-readable header (fenced YAML — unit id, mode, repo, worktree, base
  branch, wired roles, declared capabilities, the gates for this stage, absolute paths of
  applicable convention docs, the plugin root), the role-wiring block, any config-load
  problem, the source/spec block, and then stage-specific material — the requirement and
  acceptance criteria, the plan, the latest review, repo commands, prior related
  decisions mined from the index, exact tool-call templates with ids filled in. Publish
  the header as a small versioned contract so third-party clients can consume it.

Keep a single registry table mapping stage name → renderer + flags (takes-no-id,
standalone, custom spec banner). Adding a stage must mean adding one table entry.

Token economy is a design goal: measure the instruction load of a full run. Techniques
that earn their keep: mode-specific sections split into separate files loaded on demand;
one shared "standing rules" file referenced from dispatch prompts instead of inlined;
appendix-style reference material at the bottom of skills rather than separate parallel
documents.

## 6. Tool surface

Expose a small number of consolidated tools (target: ~a dozen), each taking an `action`
discriminator plus that action's parameters, grouped by noun: lifecycle/state, requirement
context, deterministic analysis, gates and evidence, command running, git operations, PR
bookkeeping, story summary, cross-story search, the ledger, review-bot bookkeeping, diff
audits, and operations/diagnosis. Rules that keep the surface honest:

- Per-action parameter validation with real error messages after dispatch (a merged
  optional-everything schema is unavoidable at the surface; enforce per-action inside).
- Every response carries the human text plus a small versioned JSON result envelope
  (ok/summary/data/suggested-next-actions).
- Tool descriptions are part of the product: never advertise an action that does not
  exist, never hardcode a count that can drift — compute it.
- Multiple evidence-recording verbs collapse into one action with a `kind` discriminator,
  each kind keeping its own schema and remedy text.

Useful at any moment, cheap to call: a one-line status of any unit; a dry-run "explain"
of the next stage (its gates with live pass/fail, the roles it consults, what it
produces); and a read-only **doctor** that reports the inferred repo profile with
evidence, config layers with provenance and validation errors, wired roles, loaded packs,
environments, store health, build health — and proposes a ready-to-write repo config.

## 7. Configuration

Three YAML layers with rising precedence — mappings merge recursively, while lists and scalars overwrite:
built-in defaults → a per-user file in the home directory → a per-repo file at the git
root. An env var can substitute an explicit file for the user layer (tests/CI). Add-on
pack fragments merge *underneath* everything so user choices always win.

- Every section optional; an empty config is fully functional.
- A broken layer is skipped with a recorded, precisely-located error (file, key, line,
  the valid keys at that path) that surfaces in every rendered context and in the doctor —
  the server never refuses to boot over config.
- Schema-version the format; reject obsolete layouts with a pointer, don't migrate
  forever.
- **Zero-config inference:** when no profile exists, the engine reads the checkout itself:
  repository identity from the git remote, the default branch, the package manager from
  lockfiles, and the verification/test/lint/typecheck/install commands from the
  ecosystem's own manifest scripts (node, PHP, Python, Go, Rust, make) — attaching the
  evidence for each guess so setup can later pin it.
- Ticket-pattern config maps id shapes to repos, default sub-projects, URL templates, and
  per-boundary tracker status names (returned as *suggestions* for the assistant to apply;
  the engine never transitions a ticket).
- Credentials never live in config: a dotenv file holds environment logins and the
  second-opinion-model key, resolved through per-environment env-var prefixes.

**Packs** are the extension mechanism for stack opinions: external directories, each a
manifest fragment in the same schema plus doc files — convention documents selected by
tag or capability, diff-audit rule sets, gate overrides, custom gates. The core ships
engines (rule runner, doc selector, gate registry) with no opinions; packs ship opinions
with no code. Resolve packs from an env-var path list, a user directory, the plugin
manager's install cache, and a sibling checkout, in that order.

## 8. Quality machinery

**Gate registry.** Every gate registers with an id, its stage, a description, a default
severity, an optional required capability, and a check function reading recorded state.
The config may soften a gate to warn-only, switch it off, restrict it to a capability, and add custom
gates as shell commands run in the worktree. Transitions hard-fail on unmet blocking
gates with concrete remedies; run modes demote per their definition. One resolution path
serves the transition tool, the explain view, the hooks, and the rendered header.

Evidence the gates consume, each recorded via the single evidence action:

- **Self-critique:** before commit, the assistant runs a structured adversarial pass over
  its own diff (the server supplies the prompt; the assistant does the thinking) and
  records findings — an explicit empty list is valid, silence is not.
- **Defect reproduction:** bug-shaped tickets require a failing test recorded *before*
  the fix (location, command, verbatim red output), closed later with the green output;
  waivable only with a written rationale that travels into the PR.
- **Coverage-reach audit:** for every new surface the change ships, record whether each
  relevant gate's own subject list (e2e specs, mock handlers, contract docs) was actually
  extended to include it — a green check that never selects the new code is the failure
  mode that survives everything else.
- **Pre-work validity verdicts:** structured reviewer calls (technical and product
  dimensions, primary and second model) with a computed consensus.
- Plus: an impact-radius analysis computed from the diff (who consumes what changed), a
  personal-data audit over added lines (data flowing to logs, storage, analytics, error
  bodies — blocking unless waived with a rationale), acceptance-criteria validation
  evidence per criterion, and a claims audit over factual assertions headed for the PR.

**Multi-column review.** The review stage gathers findings from parallel, differently-
framed sources — a criteria-vs-diff pass in both directions (every criterion needs proof;
every hunk needs a criterion), specialist lenses (architecture, security, tests,
performance, plus capability-gated lenses like component-library conformance and
accessibility), config/pack diff-audit rules, the carry-forward ledger re-verification,
an in-cycle adversarial pass, the second-opinion model when configured, and browser
findings where applicable — then a deterministic synthesis tool merges the columns into
one verdict (ship / needs-attention / not-ready) with severity counts, persisted per
cycle. A separate **red-team** stage runs once per unit after fixes settle: fresh-eyes
challenge of everything prior reviewers accepted, sticky once passed.

**Second-opinion model.** An out-of-band review by an independent model, resolved
through: a configured companion CLI → an HTTP API → a same-model fallback stub that
declares itself. Track structured findings across cycles with a per-finding-class
iteration cap so the loop converges instead of relitigating.

**Browser checking.** For profiles that declare a testable UI: exercise every acceptance
criterion through an actual browser session pointed at the environment chosen by role,
covering the edge cases each criterion implies; reproduce runtime errors against the reference environment;
run the project's e2e suite; attach annotated screenshots to the PR via the code-host
tools. Scope discipline is explicit: no roaming regression sweeps; out-of-scope
observations are recorded but cannot drive the verdict.

**Safety hooks** (host-level command interception, outside the prompt): block
verification bypass flags on commit/push; block pushes to protected branches (config
list, env override, per-command escape hatches); scan staged diffs for credential shapes;
block oversized staged files; warn on personal data heading to sinks; run the commit
gate on `git commit` and the PR gate on push/PR-creation commands; preview transition
verdicts; print a status line when the session stops. Implement as one committed
runtime-language entry point (no shell-tool dependencies) that dispatches guard names.
Critical detail: on an unbuilt checkout the hooks must fail *loud* — block the dangerous
verbs with build instructions while letting everything else (including the build) pass
with a warning. Silent degradation of a safety layer is the one unacceptable default.
Guards resolve the work unit from the current branch name; no match means silence.

## 9. Conduction (the full-pipeline flow)

A **conductor** flow drives the whole pipeline by spawning one fresh subagent per stage:

- The conductor never does stage work itself. Each dispatch prompt tells the subagent
  which skill file to read (absolute path), to request its rendered context with a flag
  that suppresses the single-stage stop banner, to follow every step, and to finish by
  reporting a structured result into server state.
- Routing is state-driven: after each subagent, the conductor asks the server what to do
  next and receives {next stage, proceed/retry/blocked/done, verdict, questions for the
  human}. The conductor never parses subagent prose for markers.
- The standing rules bound every dispatch (referenced, not inlined): scope — build
  exactly what the criteria require, surface extras as proposed follow-ups; cross-check
  criteria against linked items, the parent, siblings, and prior PRs, and stop on
  contradictions; refresh remote refs before any diff or base comparison, and compare
  against remote refs only; never post to a human without explicit user approval.
  The conductor is the backstop: it checks each stage report against these and
  re-dispatches on breach.
- Checkpoints: blocked questions go to the user and their answers are persisted into the
  story record; commit failures get a bounded retry path; resumed sessions first run a
  reconciliation step that compares stored state against live reality (tracker status,
  branch, uncommitted work, PR state) and surfaces every disagreement rather than
  trusting the artifact.
- After the PR: an optional **review-bot loop** when a bot role is wired — mark ready,
  poll the bot's status context (bounded), pull its threads into state, dispatch a
  feedback subagent to fix-or-reply (one batched commit per round, threads resolved on
  the host so the loop converges), capped at two rounds before deferring to the human.
- Wrap-up renders: the PR link, a stage-by-stage results table populated from state only,
  the scope ledger (criterion → proof → status), a deliberately-not-built list, any
  drafts held for human approval, and — for reduced modes — an explicit "what this run
  did not prove" section.
- A batch variant pre-flights several ids (recon+plan only), clusters them by predicted
  file overlap with human approval of the grouping, then runs groups sequentially with
  cross-linked state.

## 10. Distribution and operations

- Ship as one plugin: manifest declaring the skills, hooks, and server entry explicitly;
  a marketplace descriptor so installation is `add marketplace → install`; the built
  output committed so installs need no build step. One name, one version, everywhere.
- A companion packs plugin ships stack opinions, installable the same way; the core must
  run fully without it.
- Other MCP clients get the same server over stdio plus the skill files read directly;
  nothing may assume the branded host beyond the hook payload adapter.
- First-run setup is a conversation: run the doctor, map the session's visible tools onto
  roles by name heuristics, ask about bot/second-model/packs/environments, show the
  proposed repo config, write it only on confirmation.
- Time tracking: stage timers with idle-gap detection feed a worklog suggestion at the
  PR boundary.

## 11. Testing strategy

Aim for a dense unit/contract suite (several hundred cases) with these properties:

- Hermetic: no network; temp-dir stores; fixture config pinned by env var; never read the
  developer's real home config or store; beware hidden cwd dependence (a test that
  behaves differently when the suite runs inside a git checkout is a bug).
- Contract tests: the rendered-header schema, the result envelope, tool count and action
  inventory computed from the registry (never hand-maintained), every stage renderable
  with a completely empty config (proving the no-integrations path), skills well-formed
  (frontmatter, no legacy tool names, required call templates present).
- The vendor/jargon lint over every shipped file, at zero, with a marked-line escape
  hatch for genuine compatibility shims.
- Real-git integration tests in temp repos for inference, diffing, worktree setup, hooks.

## 12. Non-goals

Explicitly out of scope: hosting model calls, storing third-party credentials, mutating
tracker state directly, deployment/release management, and any framework-specific
knowledge in the core (that is what packs are for).

---

## Appendix: suggested working vocabulary (rename freely)

| Concept | Working name here | Alternatives |
|---|---|---|
| Full-pipeline flow | conduct | pilot, drive, run, helm |
| Requirement research stage | recon | scout, intake, frame |
| Implementation stage | build | forge, make |
| Post-review correction stage | patch | mend, revise |
| Final adversarial stage | red-team | gauntlet, crucible |
| Browser validation stage | browser-check | walkthrough, proof |
| PR stage | pull-request | publish, submit |
| Archival stage | sweep | retire, shelve |
| Ticket validity triage | vet | triage, screen |
| Readiness review | groom | shape, refine |
| Reduced presets | swift / raw | express / sketch |
| Record store | store | vault, journal, ledger-root |
| Carry-forward record | ledger | tab, docket |
| Rendered dynamic context | briefing | stage brief, worksheet |
| Capability roles | roles | seats, sockets, adapters |
| Add-on opinion bundles | packs | kits, overlays |
| Second-opinion model | second-opinion | counterweight, devil's advocate |

Build it your way. The constraints that matter are in sections 2, 4, 5, 8, and the loud-
failure rule in section 8; everything else is yours to reshape.
