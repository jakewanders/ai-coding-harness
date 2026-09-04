# Build log

One line per completed task: `NN · title · tests <n> · note`.

01 · Project scaffold and hermetic test harness · tests 5 · Setup also rewrites HOME so os.homedir() lands in the temp home; typescript 7.0.2 and vitest 5 pinned exact.
02 · Vocabulary lint · tests 12 · Product names are word-bounded so the run modes express/sketch and the envelope field next do not trip the lint; clean-room words match as substrings.
03 · Result envelope and brief header contracts · tests 24 · SeatName, Severity and ConfigError are defined once in contracts/header.ts; config/schema.ts, config/load.ts and registry/gates.ts will re-export them.
04 · Vault paths and repo namespace · tests 38 · repoNamespace lowercases the host and keeps nested group paths; ensureVault uses init.defaultBranch=main so it is quiet under a temp HOME.
05 · Unit state, migrations, history · tests 48 · Zod schema lives in store/schema.ts to avoid a state/migrations import cycle; evidence/kinds.ts created early with the kind names only.
06 · Configuration layers · tests 60 · valid_keys comes from walking the zod def tree (object/record/array/optional); fixed a millisecond-flaky round-trip expectation in the state test.
07 · Zero-config repo inference · tests 75 · Test repos get their bare origin through git clone --bare plus fetch and remote set-head, so no test ever runs git push.
08 · Unit ids and ticket patterns · tests 86 · unitFromBranch also recognizes a known synthetic id used as a branch segment prefix (local-xxxxxxxx-title); invalid ticket regexes are skipped rather than thrown.
09 · Tool registry, dispatch, server, generated inventory · tests 100 · Server uses the low-level SDK Server so each tool gets one merged JSON schema; test/helpers/ctx.ts makeCtx builds a hermetic ToolContext for later tool tests.
10 · Stage registry, gate registry, mode resolution · tests 118 · resolveGates takes an optional gate list so tests inject fakes; off gates resolve n/a without running; sketch demotes the review/challenge/verify gates to off in addition to skipping the stages.
11 · unit tool: start, status, list, brief, explain, advance · tests 133 · Fake gates in tests must be scoped to their own unit id because the gate registry is process-global; nextStageFor routes revise back to commit and drops verify without browser_ui.
12 · spec tool: requirement context · tests 143 · requirement.md is the single store for title, url, body and criteria so re-setting criteria rewrites the file from the parsed form rather than appending a second section.
13 · exec tool: command running with logs · tests 154 · Run logs put exit and timing in a header so `exec logs --tail` returns output lines; the hermetic vault lives outside HOME so home-relative assertions need a vault under HARNESS_HOME.
14 · vcs tool: fetch, diff, branch, worktree, commit, cleanup · tests 165 · git diff skips untracked files, so vcs diff appends --no-index diffs for them; remote commits land in tests via the bare repo fetching from a clone, never push.
15 · evidence tool and the first real gates · tests 178 · Gates must never read process.cwd() (it is this checkout under vitest); GateContext.cwd carries the caller cwd and GateOutcome.applicable=false yields n/a for kind-scoped gates.
16 · pullreq tool: PR bookkeeping, ghostwritten body, worklog · tests 191 · recordActivity exists for idle-gap accrual but no tool calls it yet; timers only accrue idle when a later task wires activity touches.
17 · digest and recall tools · tests 202 · Index entries are keyed by (repo, id); reindex walks the vault for units/<id>/digest.md so nested host/owner/name namespaces work.
18 · Shared prose and the ten core stage skills · tests 211 · Call templates live in fenced ```harness blocks (tool action {json}) so the contract test can check every tool/action against the registry; frontmatter descriptions must be quoted when they contain a colon.
19 · pilot flow: route, report, answer, reconcile · tests 254 · unit route both decides and applies the move (gates enforced on proceed, not on retry), so the conductor never calls unit advance itself; flows register renderers via src/flows/index.ts side-effect import.
20 · analyze tool: impact, pii, claims, reach, criteria map · tests 276 · criteria_map records matched criteria as unproven with a keyword-map hint rather than proven, so the publish gate still demands real proof; correction-loop advances are ungated.
21 · diffaudit tool, review columns, synthesis, challenge · tests 291 · The counterweight column is required only when the seat is wired and the mode keeps counterweight_consulted at block; synthesis uses the latest record per column in the cycle.
22 · ledger tool and re-verification · tests 296 · The ledger is keyed by repo namespace next to units/; recheck records only the last unit, so each new unit must recheck every open entry again (the gate stays warn).
23 · Counterweight resolution and convergence · tests 305 · The CLI provider passes the prompt via the COUNTERWEIGHT_PROMPT env var since runCommand has no stdin; the http provider is only chosen when a key is present, otherwise the declared stub is used.
24 · Run modes wired through brief, route, and PR body · tests 310 · demotionsOf previously dropped counterweight_consulted → warn once the gate (default warn) was registered, making output depend on import order; same-rank declared demotions are now kept.
25 · verify stage: browser validation brief and gate · tests 317 · The brief reads ~/.harness/.env only to list credential variable names; values are never rendered (asserted). browser_findings schema replaced the provisional Task 15 shape.
26 · Safety hooks with loud failure · tests 332 · Blocks use both the JSON deny decision and exit code 2 so either host convention refuses the command; the bootstrap also blocks dangerous verbs if the built implementation throws.
27 · screen and shape flows with verdict consensus · tests 344 · The shape brief writes drafts/clarify.md as a side effect of rendering so the draft always matches what the reader saw; consensus agreement is over present calls, missing slots go to dissent.
28 · inspect, respond, aftercare flows · tests 350 · Aftercare bucketing is a wording heuristic and the brief says so; respond and aftercare write their drafts during render like shape does.
29 · botprs and draft flows · tests 355 · seats.tracker gains an optional create list (not in spec section 5 but required by the draft flow); the draft brief detects create tools by name when the list is empty.
