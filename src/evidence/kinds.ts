/**
 * Evidence kinds a unit can record. The per-kind schemas and remedies
 * (`EVIDENCE_KINDS`) are added with the evidence tool; the names live here so
 * the state schema can validate records without importing the tool layer.
 */
export const EVIDENCE_KIND_NAMES = [
  'self_critique',
  'defect_repro',
  'reach_audit',
  'screen_verdict',
  'impact',
  'pii',
  'criteria_validation',
  'claims',
  'waiver',
  'browser_findings',
  'counterweight',
  'review_column',
] as const;

export type EvidenceKind = (typeof EVIDENCE_KIND_NAMES)[number];
