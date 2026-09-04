# Severity rubric

<!-- distinctive: Severity describes consequence if shipped as-is, not effort to fix. -->

Severity describes consequence if shipped as-is, not effort to fix. Every evidence kind that carries findings uses these four levels.

- **blocker** — ships a defect, data loss, security hole or an unmet acceptance criterion. Verdict cannot be `ship` while one is open.
- **major** — wrong or fragile behavior a user or operator will hit; must be fixed or explicitly deferred with a rationale before publish.
- **minor** — correctness is intact but quality suffers (naming, duplication, missing test for an edge). Fix if cheap, otherwise defer.
- **note** — an observation, question or suggestion with no required action.

Synthesis rule of thumb: any blocker → `not_ready`; any major → `needs_attention`; only minor and note → `ship`.
