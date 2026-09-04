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
