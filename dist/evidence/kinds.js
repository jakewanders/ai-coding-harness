import { z } from 'zod';
/**
 * Evidence kinds a unit can record. Each kind has a concrete zod schema, a
 * remedy (what to do when it is missing or malformed) and a description.
 * An explicit empty findings list is valid; a missing record is not.
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
];
export const SEVERITIES_FINDING = ['blocker', 'major', 'minor', 'note'];
export const FindingSeveritySchema = z.enum(SEVERITIES_FINDING);
export const PII_SINKS = ['log', 'storage', 'analytics', 'error_body', 'other'];
export const REACH_SUBJECT_KINDS = ['e2e', 'mock', 'contract', 'unit', 'other'];
export const REVIEW_COLUMNS = [
    'criteria_forward', 'criteria_reverse', 'architecture', 'security', 'tests', 'performance',
    'component_library', 'accessibility', 'diffaudit', 'ledger', 'adversarial', 'counterweight', 'browser',
];
const nonEmpty = z.string().min(1);
export const SelfCritiqueSchema = z.object({
    findings: z.array(z.object({ severity: FindingSeveritySchema, text: nonEmpty, addressed: z.boolean() })),
}).strict();
export const DefectReproSchema = z.object({
    test_location: nonEmpty,
    command: nonEmpty,
    red_output: z.string(),
    green_output: z.string().optional(),
}).strict();
export const ReachAuditSchema = z.object({
    surfaces: z.array(z.object({
        surface: nonEmpty,
        subjects: z.array(z.object({ kind: z.enum(REACH_SUBJECT_KINDS), name: nonEmpty, extended: z.boolean() })),
        waived: z.boolean().optional(),
        reason: z.string().optional(),
    })),
}).strict();
export const ScreenVerdictSchema = z.object({
    dimension: z.enum(['technical', 'product']),
    reviewer: z.enum(['primary', 'second']),
    verdict: z.enum(['valid', 'invalid', 'needs_info']),
    rationale: nonEmpty,
}).strict();
export const ImpactSchema = z.object({
    changed: z.array(z.object({ path: nonEmpty, consumers: z.array(z.string()) })),
    summary: z.string(),
}).strict();
export const PiiSchema = z.object({
    findings: z.array(z.object({ file: nonEmpty, line: z.number().int().nonnegative(), sink: z.enum(PII_SINKS), text: nonEmpty })),
}).strict();
export const CriteriaValidationSchema = z.object({
    results: z.array(z.object({ criterion: nonEmpty, status: z.enum(['proven', 'unproven', 'not_applicable']), proof: z.string() })),
}).strict();
export const ClaimsSchema = z.object({
    claims: z.array(z.object({ text: nonEmpty, status: z.enum(['verified', 'unverified', 'false']), evidence: z.string() })),
}).strict();
export const WaiverSchema = z.object({
    gate: nonEmpty,
    rationale: nonEmpty,
}).strict();
export const BrowserFindingsSchema = z.object({
    environment: nonEmpty,
    findings: z.array(z.object({
        criterion: z.string().optional(),
        severity: FindingSeveritySchema,
        text: nonEmpty,
        in_scope: z.boolean(),
        screenshot: z.string().optional(),
    })),
}).strict();
export const CounterweightSchema = z.object({
    provider: nonEmpty,
    findings: z.array(z.object({ class: nonEmpty, severity: FindingSeveritySchema, text: nonEmpty })),
}).strict();
export const ReviewColumnSchema = z.object({
    column: z.enum(REVIEW_COLUMNS),
    findings: z.array(z.object({ severity: FindingSeveritySchema, text: nonEmpty, path: z.string().optional(), line: z.number().int().optional() })),
}).strict();
export const EVIDENCE_KINDS = {
    self_critique: {
        schema: SelfCritiqueSchema,
        describe: 'The author reviews their own diff and lists findings with severity; an empty list is a valid result.',
        remedy: 'record self_critique with { findings: [{ severity, text, addressed }] } (an empty findings list is valid)',
    },
    defect_repro: {
        schema: DefectReproSchema,
        describe: 'A failing test captured before the fix: location, command, verbatim red output, later the green output.',
        remedy: 'record defect_repro with { test_location, command, red_output } captured before the fix (green_output optional)',
    },
    reach_audit: {
        schema: ReachAuditSchema,
        describe: 'For each new surface, whether each relevant gate subject list (e2e specs, mocks, contracts) was extended to cover it.',
        remedy: 'record reach_audit with { surfaces: [{ surface, subjects: [{ kind, name, extended }] }] }',
    },
    screen_verdict: {
        schema: ScreenVerdictSchema,
        describe: 'A structured validity call on a ticket along one dimension by one reviewer.',
        remedy: 'record screen_verdict with { dimension: technical|product, reviewer: primary|second, verdict: valid|invalid|needs_info, rationale }',
    },
    impact: {
        schema: ImpactSchema,
        describe: 'Impact radius computed from the diff: what changed and who consumes it.',
        remedy: 'record impact with { changed: [{ path, consumers: [] }], summary }',
    },
    pii: {
        schema: PiiSchema,
        describe: 'Personal-data audit over added lines: data flowing to logs, storage, analytics or error bodies.',
        remedy: 'record pii with { findings: [{ file, line, sink: log|storage|analytics|error_body|other, text }] } (empty findings means clean)',
    },
    criteria_validation: {
        schema: CriteriaValidationSchema,
        describe: 'Per acceptance criterion: proven, unproven or not applicable, with the proof.',
        remedy: 'record criteria_validation with { results: [{ criterion: AC-n, status: proven|unproven|not_applicable, proof }] }',
    },
    claims: {
        schema: ClaimsSchema,
        describe: 'Audit of factual assertions headed for the PR body.',
        remedy: 'record claims with { claims: [{ text, status: verified|unverified|false, evidence }] }',
    },
    waiver: {
        schema: WaiverSchema,
        describe: 'A written rationale for skipping a waivable gate; travels into the PR body.',
        remedy: 'record waiver with { gate, rationale } naming the gate being waived',
    },
    browser_findings: {
        schema: BrowserFindingsSchema,
        describe: 'Findings from exercising acceptance criteria in a real browser against a chosen environment.',
        remedy: 'record browser_findings with { environment, findings: [{ criterion?, severity, text, in_scope, screenshot? }] }',
    },
    counterweight: {
        schema: CounterweightSchema,
        describe: 'Second-opinion model findings with the provider that produced them.',
        remedy: 'record counterweight with { provider, findings: [{ class, severity, text }] }',
    },
    review_column: {
        schema: ReviewColumnSchema,
        describe: 'One review column (criteria, specialist lens, diffaudit, ledger, adversarial, counterweight, browser) for the current cycle.',
        remedy: 'record review_column with { column, findings: [{ severity, text, path?, line? }] }',
    },
};
export function isEvidenceKind(s) {
    return EVIDENCE_KIND_NAMES.includes(s);
}
