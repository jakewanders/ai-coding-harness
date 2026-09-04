# Token budget

Instruction load of a full run, measured with `system tokens` (tokens ≈ bytes / 4). A row
is one core stage: its skill file, the mode file loaded for that mode, and the brief
rendered for a fixture unit with no requirement, plan or review recorded. Shared prose is
counted once because every skill references it by `@root/` path and never inlines it (the
skills contract test enforces this).

The contract test `test/contracts/token-budget.test.ts` re-measures on every run and fails
when the recorded thorough total drifts more than 10% from the live number, or when any
stage exceeds 6,000 estimated tokens.

## Method

- Skill bytes: `skills/<stage>/SKILL.md` on disk.
- Mode bytes: `skills/<stage>/modes/<mode>.md` when the mode is not `thorough` and the
  file exists.
- Brief bytes: `unit brief` rendered with `quiet: true` for a fixture unit at that stage,
  empty config, no kits.
- Real briefs grow with the requirement, plan (capped at 6,000 bytes, about 1,500 tokens)
  and latest-review sections; the worst case stays under the 6,000-token stage cap.

## Before (thorough, 2026-09-04, step 36)

| Stage | Skill | Mode | Brief | Bytes | Tokens |
|---|---|---|---|---|---|
| scope | 1857 | 0 | 1993 | 3850 | 963 |
| plan | 1476 | 0 | 1640 | 3116 | 779 |
| build | 1776 | 0 | 1799 | 3575 | 894 |
| commit | 1663 | 0 | 1879 | 3542 | 886 |
| review | 2149 | 0 | 1904 | 4053 | 1014 |
| revise | 1342 | 0 | 1718 | 3060 | 765 |
| challenge | 1487 | 0 | 1644 | 3131 | 783 |
| verify | 2191 | 0 | 2870 | 5061 | 1266 |
| publish | 1686 | 0 | 1718 | 3404 | 851 |
| close | 1278 | 0 | 1625 | 2903 | 726 |
| shared (5 files) | | | | 4247 | 1062 |
| total | | | | 39942 | 9986 |

## Pass

The plan's restructuring threshold is 4,000 estimated tokens per stage. The largest stage
(verify) measures 1,266, so no material was moved into `reference.md` appendices. The
techniques from the blueprint are already in place and were verified rather than applied:

- Mode-specific sections live in `skills/<stage>/modes/<mode>.md` and load only when the
  header mode matches (build, review, publish).
- Shared prose (style, scope rules, severity, subagent etiquette, standing rules) is
  referenced from every skill and the pilot dispatch prompt, never duplicated.
- Call templates sit at the bottom of each skill and in the brief with the id filled in, so
  the reader is not sent to a second document.

## After (thorough)

Identical to the table above: no edits were needed.

| Stage | Skill | Mode | Brief | Bytes | Tokens |
|---|---|---|---|---|---|
| scope | 1857 | 0 | 1993 | 3850 | 963 |
| plan | 1476 | 0 | 1640 | 3116 | 779 |
| build | 1776 | 0 | 1799 | 3575 | 894 |
| commit | 1663 | 0 | 1879 | 3542 | 886 |
| review | 2149 | 0 | 1904 | 4053 | 1014 |
| revise | 1342 | 0 | 1718 | 3060 | 765 |
| challenge | 1487 | 0 | 1644 | 3131 | 783 |
| verify | 2191 | 0 | 2870 | 5061 | 1266 |
| publish | 1686 | 0 | 1718 | 3404 | 851 |
| close | 1278 | 0 | 1625 | 2903 | 726 |
| shared (5 files) | | | | 4247 | 1062 |
| total | | | | 39942 | 9986 |

## Other modes (after)

| Mode | Total bytes | Total tokens | Largest stage |
|---|---|---|---|
| express | 44272 | 11068 | verify (1328) |
| sketch | 46200 | 11550 | verify (1383) |

Re-measure with `system tokens { "mode": "<name>" }` after editing any skill, mode file or
renderer, and update the tables here; the contract test will remind you when the thorough
total drifts.
