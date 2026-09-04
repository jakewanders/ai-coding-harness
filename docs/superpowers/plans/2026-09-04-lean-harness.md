# Lean Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the harness down to its core value (cross-ticket record, unskippable evidence gates and hooks, scope pinned to acceptance criteria) while keeping batch runs (`convoy`), ticket triage (`screen`) and browser validation (`verify`), and ship it as 0.2.0 on a `lean` branch.

**Architecture:** Same engine, less surface. Ten core stages collapse to six (scope, build, review, verify, publish, close): plan and commit fold into build, revise and challenge fold into review. Fourteen gates become ten, twelve evidence kinds become nine, thirteen review columns become six, three modes become two. The `reviewbot` tool, the counterweight seat, the `shape`/`botprs`/`draft` flows and a handful of convenience actions are deleted rather than hidden, so the codebase reads as the lean thing. Every task is delete-or-collapse with tests updated first; nothing new is invented.

**Tech Stack:** TypeScript (strict, ESM) on Node 22, `@modelcontextprotocol/sdk`, `zod`, `yaml`, `vitest`, committed `dist/`. Same rules as the 0.1.0 build: hermetic tests, vocabulary lint at zero, `dist/` rebuilt and committed with every source change, never `git push`.

**Spec:** `docs/superpowers/specs/2026-09-04-harness-design.md` (0.1.0 design) plus the delta written in Task 1: `docs/superpowers/specs/2026-09-04-lean-harness.md`. This plan is copied to `docs/superpowers/plans/2026-09-04-lean-harness.md` in Task 1 so it travels with the repo.

## Context

The 0.1.0 build (tag `v0.1.0`, 397 tests) is complete but heavy: about 10,000 estimated tokens of instruction load per run, 13 tools, 20 stage/flow entries, 14 gates. The user wants a middle ground between that and stock Claude Code. The parts that carry the value proposition are: the per-repo vault with digests, recall and the carry-forward ledger; commit and publish gates that demand recorded evidence and that the hooks enforce even on a raw `git commit`; requirements pinned to numbered acceptance criteria with a scope ledger in the PR body. Everything else is layering. The user explicitly keeps batch runs, ticket triage and browser validation.

Assumptions made rather than asked (strike them if wrong):
- `setup` stays, because it is the zero-config entry point, and so does `system seats` which it depends on.
- Version bumps to 0.2.0; the work happens on a branch `lean` from `v0.1.0`; `main` stays at 0.1.0 until the user merges.
- `unit answer` stays (pilot's blocked-question checkpoint needs it); `unit explain` and `unit reconcile` go.
- `analyze impact` and `analyze reach` stay as informational actions but no longer record evidence or feed gates.

## Global Constraints

- Runtime dependencies are exactly `@modelcontextprotocol/sdk`, `zod`, `yaml`.
- Tests are hermetic: temp vault and fixture config via `HARNESS_VAULT` and `HARNESS_CONFIG`, never the real home directory, never dependent on the cwd being a git checkout.
- The vocabulary lint (`test/lint/vocabulary.test.ts`) stays at zero hits; escape only with `harness-lint: allow` on the same line.
- `dist/` is rebuilt and committed with every change under `src/` or `hooks/`; `npm run check:dist` must pass before every commit.
- `docs/tools.md` is generated (`npm run gen:tools`), never typed.
- Never `git push`. Never add a remote. Never edit `docs/blueprint.md`.
- Every task ends with `npm run typecheck && npm test && npm run gen:tools && npm run check:dist` green and `git status --porcelain` empty.

## Final shape (what "done" looks like)

| Area | 0.1.0 | Lean |
|---|---|---|
| Core stages | scope, plan, build, commit, review, revise, challenge, verify, publish, close | scope, build, review, verify, publish, close |
| Flows | pilot, convoy, screen, shape, inspect, respond, aftercare, botprs, draft, setup | pilot, convoy, screen, inspect, respond, aftercare, setup |
| Tools | 13 | 12 (no `reviewbot`) |
| Gates | 14 | 10: check_command_green, self_critique_recorded, defect_repro_before_fix, pii_audit_clean (build); ledger_reverified, review_verdict_ship (review); walkthrough_done, criteria_validated, claims_audited (publish); pr_recorded (close) |
| Evidence kinds | 12 | 9: self_critique, defect_repro, screen_verdict, pii, criteria_validation, claims, waiver, browser_findings, review_column |
| Review columns | 13 | 6: criteria_forward, criteria_reverse, adversarial, diffaudit, ledger, browser (requires browser_ui) |
| Modes | thorough, express, sketch | thorough, sketch |
| Seats | 7 | 6 (no counterweight) |

Routing in the lean pipeline: `scope → build → review`; review verdict `ship` → `verify` (when `browser_ui`) else `publish`; review verdict `needs_attention`/`not_ready` → back to `build` (retry, cycle increments on re-entering review) while `cycle < 4`, else blocked; `verify → publish → close`. Sketch skips `review` and `verify`. `vcs commit` moves `build → review` when its gates pass.

---

### Task 1: Branch, spec delta, plan copy

**Files:**
- Create: `docs/superpowers/specs/2026-09-04-lean-harness.md`
- Create: `docs/superpowers/plans/2026-09-04-lean-harness.md` (copy of this plan)

**Interfaces:**
- Produces: the lean spec delta every later task cites; the branch `lean`.

- [ ] **Step 1: Branch from the release tag**

```bash
cd /home/jake/repos/ai-coding-harness && git checkout -q -b lean v0.1.0 && git status --short
```

Expected: on branch `lean`, clean tree.

- [ ] **Step 2: Write the spec delta**

Create `docs/superpowers/specs/2026-09-04-lean-harness.md` with these sections, written out in full (this is the document later tasks argue from):

```markdown
# Lean harness (0.2.0) — delta from the 0.1.0 design

Everything in `2026-09-04-harness-design.md` holds unless listed here.

## Vocabulary
- Core stages: scope → build → review → [build → review]* → verify? → publish → close.
- Flows: pilot, convoy, screen, inspect, respond, aftercare, setup.
- Run modes: thorough (full), sketch (scope through build; review and verify skipped; banner in the PR body).
- Seats: tracker, codehost, docs, design, chat, reviewbot (name only; the tool is gone, the seat records which host tool reports bot status for the human).

## Removed
- Stages plan, commit, revise, challenge (folded: plan and commit into build; revise and challenge into review).
- Flows shape, botprs, draft. Tool reviewbot. Seat counterweight (config key kept as a no-op for forward compatibility: `seats.counterweight` still validates, is ignored).
- Gates impact_recorded, reach_audit_recorded, counterweight_consulted, challenge_passed.
- Evidence kinds impact, reach_audit, counterweight.
- Review columns architecture, security, tests, performance, component_library, accessibility, counterweight.
- Mode express. Actions unit explain, unit reconcile, pullreq worklog, digest handoff, system tokens, system sync.
- docs/token-budget.md and its drift test.

## Changed
- Gate table: check_command_green, self_critique_recorded, defect_repro_before_fix, pii_audit_clean guard build; review_verdict_ship and ledger_reverified guard review; walkthrough_done, criteria_validated, claims_audited guard publish; pr_recorded guards close.
- Cycle: increments each time the unit enters review after the first time.
- Routing: review verdict ship → verify when browser_ui else publish; otherwise back to build while cycle < 4.
- Required review columns for synthesis: criteria_forward, criteria_reverse, adversarial, diffaudit, ledger, plus browser when browser_ui.
- The review brief carries the adversarial-pass instructions that the challenge skill used to hold; the build brief carries the plan and commit procedure.
- analyze impact and analyze reach are informational: they print results and record nothing.
- State schema stays 1; `challenge_passed`, `bot` and `reviews` remain in the schema (reviews still used; the other two are ignored) so 0.1.0 vaults read without migration.
```

- [ ] **Step 3: Copy this plan into the repo**

```bash
mkdir -p docs/superpowers/plans && cp /home/jake/.claude/plans/hashed-floating-brooks.md docs/superpowers/plans/2026-09-04-lean-harness.md
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers && git commit -q -m "lean: spec delta and plan"
```

---

### Task 2: Modes: drop express, sketch skips review and verify

**Files:**
- Modify: `src/modes.ts` (BUILT_IN_MODES, SKETCH_BANNER)
- Delete: `skills/build/modes/express.md`, `skills/review/modes/express.md`, `skills/publish/modes/express.md`
- Modify: `skills/build/SKILL.md`, `skills/review/SKILL.md`, `skills/publish/SKILL.md` (the "If the header mode is `express`" sentence)
- Test: `test/modes.test.ts`, `test/modes.integration.test.ts`, `test/contracts/skills.test.ts`, `test/text/pr-body.test.ts`, `test/tools/digest.test.ts`, `test/tools/pullreq.test.ts`, `test/pilot/route.test.ts`, `test/review/synthesize.test.ts`

**Interfaces:**
- Produces: `BUILT_IN_MODES: Record<'thorough' | 'sketch', ModeDef>`; sketch `skip_stages: ['review', 'verify']`, `demote: { review_verdict_ship: 'off', ledger_reverified: 'off', walkthrough_done: 'off' }`, `merge_dispatches: false`, `verify_after_publish: false`. `ModeDef` keeps its shape (the two booleans stay, always false for built-ins) so config custom modes still validate.

- [ ] **Step 1: Update the mode tests to the two-mode world**

In `test/modes.test.ts`: delete the `express` case; change the sketch case to expect `skip_stages` containing `review` and `verify` (not `challenge`) and `demote.review_verdict_ship === 'off'`; change the custom-mode case to extend `sketch` instead of `express` and expect `merge_dispatches: false`; change `BUILT_IN_MODES` keys to `['thorough', 'sketch']`; in `demotionsOf` use `resolveMode('sketch', DEFAULTS)` with an added `impact_recorded: 'block'` and expect only the real demotions sorted.

In `test/modes.integration.test.ts`: replace the express test with a sketch one: brief for `build` contains `review_verdict_ship → off` and `@root/skills/build/modes/sketch.md`; delete the merged-dispatch assertion on the pilot brief; custom mode fixture extends `sketch`.

In `test/contracts/skills.test.ts` "ships mode files" test: expected files per stage become `['sketch.md']`.

Elsewhere replace `resolveMode('express', …)` fixtures: `test/text/pr-body.test.ts` "lists demotions" case uses sketch and expects `review_verdict_ship → off` and a `## Not proven` section; `test/tools/digest.test.ts` wrapup test starts the unit in `sketch`; `test/tools/pullreq.test.ts` body test starts in `sketch` and asserts `review_verdict_ship → off`; `test/review/synthesize.test.ts` drops the express counterweight assertion (the whole counterweight seat leaves in Task 4, so drop that `it` block's counterweight lines now). `test/pilot/route.test.ts` express cases are rewritten in Task 3; for now delete the four `express:` cases.

- [ ] **Step 2: Run the changed tests to see them fail**

Run: `npx vitest run test/modes.test.ts test/modes.integration.test.ts test/contracts/skills.test.ts`
Expected: FAIL (`express` still resolves; sketch skip_stages still lists challenge; express mode files still exist).

- [ ] **Step 3: Implement**

`src/modes.ts`:

```ts
export const SKETCH_BANNER = 'Nothing reviewed this diff: sketch mode skipped review and verify.';

export const BUILT_IN_MODES: Record<'thorough' | 'sketch', ModeDef> = {
  thorough: { name: 'thorough', extends: null, demote: {}, merge_dispatches: false, verify_after_publish: false, skip_stages: [], banner: null },
  sketch: {
    name: 'sketch',
    extends: 'thorough',
    demote: { review_verdict_ship: 'off', ledger_reverified: 'off', walkthrough_done: 'off' },
    merge_dispatches: false,
    verify_after_publish: false,
    skip_stages: ['review', 'verify'],
    banner: SKETCH_BANNER,
  },
};
```

Delete the three `express.md` files. In the three stage skills replace the two-sentence mode paragraph with: ``If the header mode is `sketch`, also read @root/skills/<stage>/modes/sketch.md. Other modes need no extra reading.`` Rewrite `skills/review/modes/sketch.md` only if it references `express` (it does not).

- [ ] **Step 4: Run the suite, rebuild, verify**

Run: `npm run typecheck && npm test && npm run gen:tools && npm run check:dist`
Expected: PASS except the route tests you will fix in Task 3 (if `test/pilot/route.test.ts` fails on removed express cases, that is expected only if you left them in; delete them).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -q -m "lean: drop express mode; sketch skips review and verify"
```

---

### Task 3: Collapse the core stages to six

**Files:**
- Modify: `src/store/schema.ts` (STAGE_NAMES), `src/store/state.ts` (StageName), `src/store/transition.ts`, `src/store/migrations.ts` (map old stage names on read), `src/registry/stages.ts` (CORE_ORDER, SPEC_BANNER_STAGES, nextStageFor), `src/pilot/route.ts`, `src/tools/unit.ts` (advance correction loop), `src/tools/vcs.ts` (commit moves build → review), `src/hooks/guards.ts` (commit_gate resolves stage `build`), `src/flows/pilot.ts` (stage list text), `src/stages/index.ts`, `src/stages/build.ts`, `src/stages/review.ts`
- Delete: `src/stages/plan.ts`, `src/stages/commit.ts`, `src/stages/revise.ts`, `src/stages/challenge.ts`, `skills/plan/`, `skills/commit/`, `skills/revise/`, `skills/challenge/`
- Test: `test/registry/stages.test.ts`, `test/pilot/route.test.ts`, `test/tools/unit.test.ts`, `test/tools/unit-pilot.test.ts`, `test/tools/vcs.test.ts`, `test/store/migrations.test.ts`, `test/hooks/guards.test.ts`, `test/contracts/skills.test.ts`, `test/tools/diffaudit.test.ts` (challenge_passed test), `test/tools/digest.test.ts` (wrapup timers use commit stage)

**Interfaces:**
- Produces: `StageName = 'scope'|'build'|'review'|'verify'|'publish'|'close'`; `CORE_ORDER` in that order; `nextStageFor(current, { skip, browserUi })` (the `verifyAfterPublish` option is removed); `applyTransition(state, to, at)` increments `cycle` when `to === 'review'` and the unit has entered review before (a `review` timer exists); `routeNext(state, mode, browserUi)` (the `reviewbotWired` parameter is removed in Task 5; keep it until then); `Route.next: StageName | FlowName | null` unchanged.
- Consumes: `resolveGates`, `transitionAllowed` from `src/registry/gates.ts` unchanged.

- [ ] **Step 1: Rewrite the stage registry test**

`test/registry/stages.test.ts`: `STAGES` has 13 entries; `CORE_ORDER` equals `['scope','build','review','verify','publish','close']`; flows equal `['pilot','convoy','screen','inspect','respond','aftercare','setup']` (the three removed flows leave in Task 6; until then expect 16 entries and the old flow list, then tighten in Task 6). Simplest: assert `STAGES.slice(0, 6).map(s => s.name)` equals `CORE_ORDER` and `STAGES.length === 6 + FLOW_NAMES.length`.

Add a `nextStageFor` table:

```ts
describe('nextStageFor', () => {
  const t = (c: StageName, skip: StageName[], ui: boolean) => nextStageFor(c, { skip, browserUi: ui });
  it('routes the lean pipeline', () => {
    expect(t('scope', [], false)).toBe('build');
    expect(t('build', [], false)).toBe('review');
    expect(t('review', [], false)).toBe('publish');
    expect(t('review', [], true)).toBe('verify');
    expect(t('verify', [], true)).toBe('publish');
    expect(t('publish', [], false)).toBe('close');
    expect(t('close', [], false)).toBeNull();
    expect(t('build', ['review', 'verify'], true)).toBe('publish');
  });
});
```

- [ ] **Step 2: Rewrite the route table**

Replace the `cases` array in `test/pilot/route.test.ts` with the lean table (keep the helpers `st`, `rep`, `withReports`):

```ts
const cases: Case[] = [
  ['no report dispatches the current stage', st('scope'), thorough, false, { next: 'scope', decision: 'proceed' }],
  ['scope done proceeds to build', withReports('scope', [rep('scope', 'done')]), thorough, false, { next: 'build', decision: 'proceed' }],
  ['build done proceeds to review', withReports('build', [rep('build', 'done')]), thorough, false, { next: 'review', decision: 'proceed' }],
  ['blocked report blocks with questions', withReports('build', [rep('build', 'blocked', { questions: ['Which API?'] })]), thorough, false, { next: 'build', decision: 'blocked', questions: ['Which API?'] }],
  ['review needs_attention retries via build', withReports('review', [rep('review', 'done', { verdict: 'needs_attention' })]), thorough, false, { next: 'build', decision: 'retry', verdict: 'needs_attention' }],
  ['review not_ready at cycle 4 blocks', withReports('review', [rep('review', 'done', { verdict: 'not_ready' }, 4)], { cycle: 4 }), thorough, false, { decision: 'blocked' }],
  ['review ship goes to publish without browser_ui', withReports('review', [rep('review', 'done', { verdict: 'ship' })]), thorough, false, { next: 'publish', decision: 'proceed', verdict: 'ship' }],
  ['review ship goes to verify with browser_ui', withReports('review', [rep('review', 'done', { verdict: 'ship' })]), thorough, true, { next: 'verify', decision: 'proceed' }],
  ['review without a verdict blocks', withReports('review', [rep('review', 'done')]), thorough, false, { decision: 'blocked' }],
  ['verify done proceeds to publish', withReports('verify', [rep('verify', 'done')]), thorough, true, { next: 'publish', decision: 'proceed' }],
  ['sketch: build done skips straight to publish', withReports('build', [rep('build', 'done')], { mode: 'sketch' }), sketch, true, { next: 'publish', decision: 'proceed' }],
  ['publish done proceeds to close', withReports('publish', [rep('publish', 'done')]), thorough, false, { next: 'close', decision: 'proceed' }],
  ['close done is done', withReports('close', [rep('close', 'done')]), thorough, false, { next: null, decision: 'done' }],
  ['build failed once retries', withReports('build', [rep('build', 'failed')]), thorough, false, { next: 'build', decision: 'retry' }],
  ['build failed twice retries (commit retries live here now)', withReports('build', [rep('build', 'failed'), rep('build', 'failed')]), thorough, false, { next: 'build', decision: 'retry' }],
  ['build failed three times blocks', withReports('build', [rep('build', 'failed'), rep('build', 'failed'), rep('build', 'failed')]), thorough, false, { next: 'build', decision: 'blocked' }],
  ['a report from an earlier cycle does not count', withReports('review', [rep('review', 'done', { verdict: 'ship' }, 0)], { cycle: 1 }), thorough, false, { next: 'review', decision: 'proceed' }],
];
```

- [ ] **Step 3: Update the unit, vcs, hooks, migration and wrapup tests**

`test/tools/unit.test.ts`: "moves scope to plan" becomes scope → build; the routing test advances `build → review` (satisfy the build gates first with `satisfyCommitGates`, keep the helper name or rename to `satisfyBuildGates`), then `review → build` (correction loop, ungated) then `build → review` and asserts `cycle` becomes 1; the explain test is deleted (action removed in Task 5; delete it now). `test/tools/unit-pilot.test.ts`: the gate-blocked route test advances `build` instead of `plan,build,commit`; the retry test writes stage `review` then `report needs_attention` and expects `next: 'build'`; the challenge assertion becomes: a `review` report with verdict `ship` routes to `publish`. `test/tools/vcs.test.ts`: the commit test advances only to `build` and expects `stage: 'review'` after commit; the timers assertion stays. `test/hooks/guards.test.ts`: `repoWithUnit` writes `stage: 'build'`. `test/store/migrations.test.ts`: add a case: a schema-1 state with `stage: 'commit'` reads back as `stage: 'build'`, `plan` → `build`, `revise` → `build`, `challenge` → `review`. `test/tools/digest.test.ts`: wrapup timers use `scope, build, review, publish`. `test/tools/diffaudit.test.ts`: delete the `challenge_passed` test. `test/contracts/skills.test.ts`: "start every core stage skill with unit brief" now iterates the six stages.

- [ ] **Step 4: Run the changed tests to see them fail**

Run: `npx vitest run test/registry/stages.test.ts test/pilot/route.test.ts test/tools/unit.test.ts`
Expected: FAIL on CORE_ORDER length and routing.

- [ ] **Step 5: Implement the collapse**

`src/store/schema.ts`: `STAGE_NAMES = ['scope','build','review','verify','publish','close']`. `src/store/state.ts`: same union.

`src/store/migrations.ts`: add a normalizer applied after `migrate` reaches schema 1 (in `migrate`, before `UnitStateSchema.parse`):

```ts
const STAGE_RENAMES: Record<string, string> = { plan: 'build', commit: 'build', revise: 'build', challenge: 'review' };
function normalizeStages(raw: Raw): Raw {
  const stage = typeof raw.stage === 'string' ? (STAGE_RENAMES[raw.stage] ?? raw.stage) : raw.stage;
  const timers = Array.isArray(raw.timers) ? raw.timers.map((t) => (isRecord(t) && typeof t.stage === 'string' ? { ...t, stage: STAGE_RENAMES[t.stage] ?? t.stage } : t)) : raw.timers;
  return { ...raw, stage, timers };
}
```

`src/store/transition.ts`:

```ts
const cycleIncremented = to === 'review' && state.timers.some((t) => t.stage === 'review');
```

`src/registry/stages.ts`: `CORE_ORDER = ['scope','build','review','verify','publish','close']`; `SPEC_BANNER_STAGES = new Set(['scope','build','review','verify'])`; `RoutingOptions = { skip: StageName[]; browserUi: boolean }`; `nextStageFor`:

```ts
export function nextStageFor(current: StageName, opts: RoutingOptions): StageName | null {
  if (current === 'close') return null;
  let i = CORE_ORDER.indexOf(current);
  while (i + 1 < CORE_ORDER.length) {
    const candidate = CORE_ORDER[i + 1]!;
    i += 1;
    if (opts.skip.includes(candidate)) continue;
    if (candidate === 'verify' && !opts.browserUi) continue;
    return candidate;
  }
  return null;
}
```

`src/pilot/route.ts`: remove `afterChallenge`; the review branch becomes:

```ts
if (stage === 'review') {
  const verdict = latest.verdict ?? state.reviews?.[state.cycle];
  if (!verdict) return { next: stage, decision: 'blocked', questions: ['review finished without a verdict; synthesize the review columns and report again'] };
  if (verdict !== 'ship') {
    if (state.cycle < MAX_REVIEW_CYCLES) return { next: 'build', decision: 'retry', verdict, questions: [] };
    return { next: stage, decision: 'blocked', verdict, questions: [`review verdict is ${verdict} after ${state.cycle} cycles; a human should decide how to proceed`] };
  }
  return { next: nextStageFor('review', opts) ?? 'publish', decision: 'proceed', verdict, questions: [] };
}
```

and `MAX_COMMIT_FAILURES` applies to `build` (rename the constant to `MAX_BUILD_FAILURES = 2`, cap check `stage === 'build'`). `routing()` in `src/tools/unit.ts` drops `verifyAfterPublish`; the correction-loop test in `advance` becomes `const correction = to === 'build' && state.stage === 'review';`. `src/tools/vcs.ts` commit: `if (next.stage === 'build') { next = applyTransition(next, 'review', at).state; moved = true; }` and the gate call uses `resolveGates('build', …)`. `src/hooks/guards.ts`: `commitGate` calls `gatesFor(ctx, 'build')`. `src/flows/pilot.ts`: no change needed beyond `CORE_ORDER` (it is derived). `src/stages/index.ts`: six modules. Move the gates' `stage` fields in Task 4; until then `resolveGates('build', …)` returns nothing, which makes the vcs commit test fail on "refused" — so do Task 4 Step 5 (gate stage moves) inside this task's implementation: in `src/gates/commit.ts` change all four `stage: 'commit'` to `stage: 'build'`, and in `src/gates/challenge.ts` change `review_verdict_ship` to `stage: 'review'`.

`src/stages/build.ts` sections become `['requirement', 'plan', 'commands', 'ledger']` with calls: `vcs worktree`, `exec run check`, `evidence record defect_repro`, `evidence record self_critique`, `evidence record pii`, `evidence gates`, `vcs commit`; purpose: "Plan against the criteria, implement test-first in the worktree, record the self-critique and personal-data audit, and commit through the gates." `src/stages/review.ts` sections `['requirement', 'plan', 'review', 'ledger']` with calls: `vcs diff`, `evidence record review_column criteria_forward`, `… criteria_reverse`, `… adversarial`, `diffaudit run`, `ledger recheck`, `evidence synthesize`, `unit report`; purpose adds the fresh-eyes adversarial pass. Delete `plan.ts`, `commit.ts`, `revise.ts`, `challenge.ts` and their skill directories; rewrite `skills/build/SKILL.md` (procedure: write `plan.md` with Steps/Tests/Risks/Deferred, bug → red test first, implement, `exec run` check, self-critique, pii, `vcs commit`) and `skills/review/SKILL.md` (columns, adversarial pass "assume every earlier reader was wrong", synthesize, report verdict; findings → `unit report` with `needs_attention`, the engine routes back to build).

- [ ] **Step 6: Run the suite, rebuild, verify**

Run: `npm run typecheck && npm test && npm run gen:tools && npm run check:dist`
Expected: PASS. If `test/contracts/render-empty.test.ts` or `test/contracts/skills.test.ts` fail on the removed stages, fix the expectations (they iterate `STAGES`, so they should pass unchanged).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -q -m "lean: collapse to six core stages; plan and commit fold into build, revise and challenge into review"
```

---

### Task 4: Prune gates, evidence kinds and review columns; drop the counterweight seat

**Files:**
- Delete: `src/gates/counterweight.ts`, `src/gates/challenge.ts` (after moving `review_verdict_ship` into `src/gates/review.ts`), `src/review/counterweight.ts`, `test/review/counterweight.test.ts`
- Modify: `src/gates/review.ts` (remove impact_recorded and reach_audit_recorded; add review_verdict_ship), `src/gates/index.ts`, `src/evidence/kinds.ts` (remove impact, reach_audit, counterweight), `src/review/columns.ts`, `src/review/synthesize.ts` (no change), `src/tools/analyze.ts` (impact and reach stop recording), `src/tools/evidence.ts` (synthesize required set), `src/text/pr-body.ts` (evidence section drops impact/reach lines), `src/contracts/header.ts` (SEAT_NAMES drops counterweight), `src/brief/seats.ts`, `src/config/schema.ts` (seats.counterweight stays optional and is ignored), `src/config/defaults.ts`, `src/registry/gates.ts` (hasSeat unchanged), `docs/brief-contract.md` (seat list)
- Test: `test/gates/commit.test.ts`, `test/tools/evidence.test.ts` (SAMPLES), `test/tools/analyze.test.ts`, `test/review/synthesize.test.ts`, `test/text/pr-body.test.ts`, `test/contracts/header.test.ts` (SEAT_NAMES), `test/registry/gates.test.ts`, `test/tools/diffaudit.test.ts` (BASE columns)

**Interfaces:**
- Produces: `EVIDENCE_KIND_NAMES` = the nine kinds; `REVIEW_COLUMNS` = criteria_forward, criteria_reverse, adversarial, diffaudit, ledger, browser(requires browser_ui); `requiredColumns({ config, repo, mode })` = those whose requirement is met; `SEAT_NAMES` = tracker, codehost, docs, design, chat, reviewbot; `BriefHeader.seats` keyed by those six; `allGates()` returns ten gates.

- [ ] **Step 1: Update tests**

`test/gates/commit.test.ts`: registered-gates test expects stages `build` for the four commit gates and adds `review_verdict_ship: review`, `walkthrough_done: publish`; asserts `allGates().map(g => g.id).sort()` equals the ten ids. `test/tools/evidence.test.ts`: remove the `impact`, `reach_audit`, `counterweight` SAMPLES entries and the `reach_audit` line in "accepts explicit empty findings". `test/tools/analyze.test.ts`: impact test asserts `state.evidence` stays empty and `envelope.next` is `[]`; reach test asserts no `reach_audit` record and that the waiver/gate part is removed. `test/review/synthesize.test.ts`: `BASE = ['criteria_forward','criteria_reverse','adversarial','diffaudit','ledger']`, columns test expects the six ids, requiredColumns with browser_ui adds `browser`. `test/text/pr-body.test.ts`: drop `impact:` and `reach:` expectations and their fixtures. `test/contracts/header.test.ts`: seats sample has six keys; "lists the seven seats" becomes six. `test/tools/diffaudit.test.ts`: `BASE` as above. `test/registry/gates.test.ts`: unchanged (fake gates).

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run test/gates test/tools/evidence.test.ts test/review test/contracts/header.test.ts`
Expected: FAIL on gate ids, kind names, seat names.

- [ ] **Step 3: Implement**

`src/contracts/header.ts`: `SEAT_NAMES = ['tracker','codehost','docs','design','chat','reviewbot'] as const`; `HeaderSchema.seats` object drops `counterweight`. `src/brief/seats.ts`: remove the counterweight branch. `src/config/schema.ts`: keep `counterweight` in `SeatsSchema` (ignored). `src/config/defaults.ts`: keep the key. `src/evidence/kinds.ts`: delete `ImpactSchema`, `ReachAuditSchema`, `CounterweightSchema`, their entries and names; `REVIEW_COLUMNS` const becomes `['criteria_forward','criteria_reverse','adversarial','diffaudit','ledger','browser']`. `src/review/columns.ts`:

```ts
export const REVIEW_COLUMNS: ReviewColumnDef[] = [
  { id: 'criteria_forward', describe: 'Every acceptance criterion has proof in the diff or tests.' },
  { id: 'criteria_reverse', describe: 'Every hunk traces to a criterion.' },
  { id: 'adversarial', describe: 'Fresh-eyes pass assuming every earlier reader was wrong: unmet criteria, untested branches, silent failures, data exposure.' },
  { id: 'diffaudit', describe: 'Config and kit diff-audit rules.' },
  { id: 'ledger', describe: 'Carry-forward ledger items re-verified against this diff.' },
  { id: 'browser', describe: 'Browser findings against the acceptance criteria.', requires: 'browser_ui' },
];
export function requiredColumns({ config, repo }: RequiredColumnsInput): string[] {
  return REVIEW_COLUMNS.filter((c) => !c.requires || hasCapability(config, repo, c.requires)).map((c) => c.id);
}
```

`src/gates/review.ts` keeps only `ledgerReverified` (move from ledger.ts or leave ledger.ts as is) and gains `reviewVerdictShip` with `stage: 'review'` (move the body from challenge.ts). `src/gates/index.ts` imports commit, review, ledger, verify, publish, close. `src/tools/analyze.ts`: `impact` and `reach` handlers no longer call `record` and return `envelope(..., [])`; `reach` keeps computing `covered_by` and the `uncovered` list. `src/text/pr-body.ts`: evidence section drops the impact and reach lines. `docs/brief-contract.md`: seat list without counterweight.

- [ ] **Step 4: Run the suite, rebuild, verify**

Run: `npm run typecheck && npm test && npm run gen:tools && npm run check:dist`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -q -m "lean: ten gates, nine evidence kinds, six review columns; counterweight seat removed"
```

---

### Task 5: Remove tools and actions

**Files:**
- Delete: `src/tools/reviewbot.ts`, `test/tools/reviewbot.test.ts`, `src/system/tokens.ts`, `src/system/sync.ts`, `src/pilot/reconcile.ts`, `test/pilot/reconcile.test.ts`, `src/text/handoff.ts`, `docs/token-budget.md`, `test/contracts/token-budget.test.ts`
- Modify: `src/registry/index.ts` (drop reviewbotTool), `src/tools/system.ts` (drop tokens, sync), `src/tools/unit.ts` (drop explain, reconcile; keep answer), `src/tools/pullreq.ts` (drop worklog; keep `src/time/worklog.ts` because `stageTable` uses it), `src/tools/digest.ts` (drop handoff), `src/pilot/route.ts` (drop the reviewbot branch and the `reviewbotWired` parameter), `src/flows/pilot.ts` (drop the review-bot loop section; replace with two lines: when the reviewbot seat is wired, pull bot threads with `pullreq threads` and run `respond` once, then close), `src/tools/unit.ts` route handler (drop the `!isCoreStage(next)` branch), `src/tools/reviewbot.ts` references in `README.md` and `CHANGELOG.md` (Task 8)
- Test: `test/tools/unit-pilot.test.ts` (delete reconcile and explain blocks), `test/tools/pullreq.test.ts` (delete worklog `it` that goes through the tool; keep the `suggestWorklog` unit tests), `test/tools/digest.test.ts` (delete handoff block), `test/tools/system.test.ts` (delete tokens and sync blocks), `test/contracts/inventory.test.ts` (unchanged: counts files), `test/skills` contract (pilot skill call templates must not name removed actions)

**Interfaces:**
- Produces: `allTools()` returns 12 tools; `routeNext(state, mode, browserUi)`; `unit` actions: start, status, list, brief, advance, report, route, answer, link; `system` actions: version, health, kits, doctor, config, infer, seats.

- [ ] **Step 1: Update tests** as listed in Files; in `test/tools/unit-pilot.test.ts` also assert `Object.keys(unitTool.actions)` equals `['start','status','list','brief','advance','report','route','answer','link']`.

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run test/tools/unit-pilot.test.ts test/contracts/inventory.test.ts`
Expected: FAIL (actions still present; `src/tools` still has 13 files).

- [ ] **Step 3: Implement** the deletions and edits listed in Files. In `skills/pilot/SKILL.md` remove the `unit reconcile` template line and the reviewbot sentence; in `src/flows/pilot.ts` remove the reconcile step and the review-bot section.

- [ ] **Step 4: Run the suite, rebuild, verify**

Run: `npm run typecheck && npm test && npm run gen:tools && npm run check:dist`
Expected: PASS; `docs/tools.md` no longer lists reviewbot, tokens, sync, explain, reconcile, worklog, handoff.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -q -m "lean: remove reviewbot tool, counterweight, tokens, sync, explain, reconcile, worklog, handoff"
```

---

### Task 6: Remove the shape, botprs and draft flows

**Files:**
- Delete: `src/flows/shape.ts`, `src/flows/botprs.ts`, `src/flows/draft.ts`, `src/text/ticket.ts`, `skills/shape/`, `skills/botprs/`, `skills/draft/`, `test/flows/misc-flows.test.ts`
- Modify: `src/flows/index.ts`, `src/registry/stages.ts` (`FlowName`, `FLOW_NAMES`, `NO_ID_FLOWS`), `src/flows/aftercare.ts` (the "draft it with the draft flow" sentence becomes "draft it by hand in `drafts/` and file it only after approval"), `src/config/schema.ts` and `src/config/defaults.ts` (keep `seats.tracker.create`; the setup flow still proposes it)
- Test: `test/flows/screen.test.ts` (delete the two `shape` blocks), `test/registry/stages.test.ts` (flow list = pilot, convoy, screen, inspect, respond, aftercare, setup; `STAGES.length === 13`), `test/contracts/render-empty.test.ts` (unchanged, iterates STAGES), `test/contracts/plugin.test.ts` (unchanged, reads the skills dir)

**Interfaces:**
- Produces: `FlowName = 'pilot'|'convoy'|'screen'|'inspect'|'respond'|'aftercare'|'setup'`; `NO_ID_FLOWS = inspect, convoy, setup`.

- [ ] **Step 1: Update the tests** listed above.

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run test/registry/stages.test.ts`
Expected: FAIL on the flow list.

- [ ] **Step 3: Implement** the deletions and the registry edit.

- [ ] **Step 4: Run the suite, rebuild, verify**

Run: `npm run typecheck && npm test && npm run gen:tools && npm run check:dist`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -q -m "lean: remove shape, botprs and draft flows"
```

---

### Task 7: Skills and briefs consolidation pass

**Files:**
- Modify: `skills/build/SKILL.md`, `skills/review/SKILL.md`, `skills/scope/SKILL.md`, `skills/publish/SKILL.md`, `skills/close/SKILL.md`, `skills/pilot/SKILL.md`, `skills/_shared/subagent-etiquette.md` (the "never advance" rule stays; drop the counterweight mention if any), `skills/build/modes/sketch.md`, `skills/review/modes/sketch.md` ("sketch skips review" wording), `skills/publish/modes/sketch.md`, `src/stages/_shared.ts` (`decisions` and `ledger` sections unchanged; `review` section wording), `src/flows/screen.ts` (second-model text: the second call is made by the same model with an explicitly different framing, since there is no counterweight seat; keep four records so consensus is unchanged), `src/flows/convoy.ts` (stage list "scope and build" in step 1 becomes "scope only", since plan is inside build; cluster on `plan.md` written during a `build` dry run is no longer available — cluster on the predicted files from `requirement.md` criteria text plus `plan.md` if present)
- Test: `test/contracts/skills.test.ts` (every skill: frontmatter, @root refs, call templates against the registry, no inlined shared prose; mode files exist for build, review, publish), `test/flows/screen.test.ts` (the counterweight regex becomes `/second (call|model|framing)/i`), `test/pilot/cluster.test.ts` (`predictFiles` also accepts a requirement text input: add `predictFilesFromText(text)` tests reusing the same function under a new name only if you split it; otherwise no change)

**Interfaces:**
- Consumes: `extractToolCalls`, `listSkills` from `src/skills/inspect.ts`; `findTool` from `src/registry/index.ts`.

- [ ] **Step 1: Update `test/flows/screen.test.ts` and `test/contracts/skills.test.ts`** to the new wording; run them to see failures.

- [ ] **Step 2: Rewrite the two consolidated skills.** `skills/build/SKILL.md` procedure:

```markdown
1. Ensure the unit has an isolated worktree or branch; never work on a protected branch.
2. Write `plan.md` in the unit directory: `## Steps` (ordered), `## Tests` (criterion → test), `## Risks`, `## Deferred` (proposed follow-ups outside the criteria).
3. For a bug: write the failing test first and record `defect_repro` with the red output before touching the fix.
4. Implement step by step, running the check command through `exec run` after each step.
5. Read your own diff as a reviewer and record `self_critique` (an empty list is valid). Audit added lines for personal data and record `pii`.
6. Commit only through `vcs commit`; it refuses while a gate fails and moves the unit to review when it succeeds.
```

`skills/review/SKILL.md` procedure:

```markdown
1. Fetch and read the diff against the remote base. Read the criteria, the plan and the latest review from the brief.
2. Record `criteria_forward` (every criterion has proof), `criteria_reverse` (every hunk traces to a criterion), and `browser` when the capabilities declare browser_ui.
3. Run `diffaudit run`; recheck every open ledger entry with `ledger recheck`.
4. Adversarial pass: assume every earlier reader was wrong; re-read the requirement, then the whole diff, and hunt for unmet criteria, untested branches, silent failure paths and data exposure. Record it as the `adversarial` column; an empty list is a valid, honest result.
5. `evidence synthesize`, then `unit report` with the verdict. Findings route the unit back to build; the engine increments the cycle when review starts again.
```

- [ ] **Step 3: Run the suite, rebuild, verify**

Run: `npm run typecheck && npm test && npm run gen:tools && npm run check:dist`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -q -m "lean: consolidate build and review skills; screen second call without a counterweight seat"
```

---

### Task 8: Packaging, docs, version 0.2.0, tag

**Files:**
- Modify: `package.json` (version 0.2.0), `src/index.ts` (VERSION), `.claude-plugin/plugin.json` (version, skills list regenerated from `skills/*/SKILL.md`), `README.md` (tools list 12, stages 6, flows 7, modes 2, remove counterweight from seats), `CHANGELOG.md` (0.2.0 section: what was removed and collapsed, migration note that old stage names normalize on read), `docs/BUILD_LOG.md` (one closing line for the lean pass), `docs/tools.md` (regenerated)
- Test: `test/contracts/plugin.test.ts` (unchanged; it checks version equality and the skills list), `test/smoke.test.ts` (VERSION equality)

- [ ] **Step 1: Bump the version in the three places and regenerate the skills list**

```bash
node -e "const fs=require('fs');for(const p of ['package.json','.claude-plugin/plugin.json']){const j=JSON.parse(fs.readFileSync(p));j.version='0.2.0';if(p.endsWith('plugin.json'))j.skills=fs.readdirSync('skills').filter(d=>!d.startsWith('_')&&fs.existsSync('skills/'+d+'/SKILL.md')).sort().map(d=>'./skills/'+d+'/SKILL.md');fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');}"
sed -i "s/export const VERSION = '0.1.0';/export const VERSION = '0.2.0';/" src/index.ts
```

- [ ] **Step 2: Write the CHANGELOG 0.2.0 section and update the README**, then run the full checklist:

```bash
npm run typecheck && npm test && npm run build && npm run gen:tools && npm run check:dist && git status --porcelain
```

Expected: all green, status empty after committing.

- [ ] **Step 3: Record and tag locally**

Append to `docs/BUILD_LOG.md`: `LEAN PASS COMPLETE <date> · tests <n> · tools 12 · stages 6 · flows 7 · gates 10`. Commit, then:

```bash
git add -A && git commit -q -m "lean: 0.2.0 packaging, README, CHANGELOG" && git tag -a v0.2.0 -m "harness 0.2.0 (lean)"
```

Nothing is pushed; `main` still points at 0.1.0. Merging `lean` into `main` is the user's call.

---

## Verification

End to end, after Task 8, on the `lean` branch:

1. `npm run typecheck && npm test && npm run build && npm run check:dist && npm run gen:tools` all pass; `git status --porcelain` is empty.
2. `node -e` over `dist/registry/index.js` reports 12 tools; `dist/registry/stages.js` reports `CORE_ORDER.length === 6`, `FLOW_NAMES.length === 7`; `dist/gates/index.js` then `allGates().length === 10`.
3. In a temp repo: `unit start` → `unit brief` for `build` shows the plan and commit procedure and the four build gates; `vcs commit` is refused until `self_critique`, `pii` and a green `exec run` exist, then moves the unit to review; a `review` report with `needs_attention` routes to `build` and the next review increments the cycle; a `ship` report routes to `publish` (or `verify` with `browser_ui`).
4. A 0.1.0 vault state with `stage: 'commit'` reads as `build` without error (`test/store/migrations.test.ts`).
5. The hooks still block a `git commit` on a unit branch with failing build gates (`test/hooks/guards.test.ts`).
6. `screen` still records four verdicts and a consensus; `convoy` still clusters and asks for approval; `verify` still requires every criterion to pass in the browser.
