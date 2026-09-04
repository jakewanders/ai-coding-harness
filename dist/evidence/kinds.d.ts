import { z } from 'zod';
/**
 * Evidence kinds a unit can record. Each kind has a concrete zod schema, a
 * remedy (what to do when it is missing or malformed) and a description.
 * An explicit empty findings list is valid; a missing record is not.
 */
export declare const EVIDENCE_KIND_NAMES: readonly ['self_critique', 'defect_repro', 'reach_audit', 'screen_verdict', 'impact', 'pii', 'criteria_validation', 'claims', 'waiver', 'browser_findings', 'counterweight', 'review_column'];
export type EvidenceKind = (typeof EVIDENCE_KIND_NAMES)[number];
export declare const SEVERITIES_FINDING: readonly ['blocker', 'major', 'minor', 'note'];
export type FindingSeverity = (typeof SEVERITIES_FINDING)[number];
export declare const FindingSeveritySchema: z.ZodEnum<{
    blocker: "blocker";
    major: "major";
    minor: "minor";
    note: "note";
}>;
export declare const PII_SINKS: readonly ['log', 'storage', 'analytics', 'error_body', 'other'];
export declare const REACH_SUBJECT_KINDS: readonly ['e2e', 'mock', 'contract', 'unit', 'other'];
export declare const REVIEW_COLUMNS: readonly ['criteria_forward', 'criteria_reverse', 'architecture', 'security', 'tests', 'performance', 'component_library', 'accessibility', 'diffaudit', 'ledger', 'adversarial', 'counterweight', 'browser'];
export type ReviewColumn = (typeof REVIEW_COLUMNS)[number];
export declare const SelfCritiqueSchema: z.ZodObject<{
    findings: z.ZodArray<z.ZodObject<{
        severity: z.ZodEnum<{
            blocker: "blocker";
            major: "major";
            minor: "minor";
            note: "note";
        }>;
        text: z.ZodString;
        addressed: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strict>;
export declare const DefectReproSchema: z.ZodObject<{
    test_location: z.ZodString;
    command: z.ZodString;
    red_output: z.ZodString;
    green_output: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const ReachAuditSchema: z.ZodObject<{
    surfaces: z.ZodArray<z.ZodObject<{
        surface: z.ZodString;
        subjects: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                contract: "contract";
                e2e: "e2e";
                mock: "mock";
                other: "other";
                unit: "unit";
            }>;
            name: z.ZodString;
            extended: z.ZodBoolean;
        }, z.core.$strip>>;
        waived: z.ZodOptional<z.ZodBoolean>;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strict>;
export declare const ScreenVerdictSchema: z.ZodObject<{
    dimension: z.ZodEnum<{
        product: "product";
        technical: "technical";
    }>;
    reviewer: z.ZodEnum<{
        primary: "primary";
        second: "second";
    }>;
    verdict: z.ZodEnum<{
        invalid: "invalid";
        needs_info: "needs_info";
        valid: "valid";
    }>;
    rationale: z.ZodString;
}, z.core.$strict>;
export declare const ImpactSchema: z.ZodObject<{
    changed: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        consumers: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    summary: z.ZodString;
}, z.core.$strict>;
export declare const PiiSchema: z.ZodObject<{
    findings: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        sink: z.ZodEnum<{
            analytics: "analytics";
            error_body: "error_body";
            log: "log";
            other: "other";
            storage: "storage";
        }>;
        text: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strict>;
export declare const CriteriaValidationSchema: z.ZodObject<{
    results: z.ZodArray<z.ZodObject<{
        criterion: z.ZodString;
        status: z.ZodEnum<{
            not_applicable: "not_applicable";
            proven: "proven";
            unproven: "unproven";
        }>;
        proof: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strict>;
export declare const ClaimsSchema: z.ZodObject<{
    claims: z.ZodArray<z.ZodObject<{
        text: z.ZodString;
        status: z.ZodEnum<{
            false: "false";
            unverified: "unverified";
            verified: "verified";
        }>;
        evidence: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strict>;
export declare const WaiverSchema: z.ZodObject<{
    gate: z.ZodString;
    rationale: z.ZodString;
}, z.core.$strict>;
export declare const BrowserFindingsSchema: z.ZodObject<{
    environment: z.ZodString;
    findings: z.ZodArray<z.ZodObject<{
        criterion: z.ZodOptional<z.ZodString>;
        severity: z.ZodEnum<{
            blocker: "blocker";
            major: "major";
            minor: "minor";
            note: "note";
        }>;
        text: z.ZodString;
        in_scope: z.ZodBoolean;
        screenshot: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strict>;
export declare const CounterweightSchema: z.ZodObject<{
    provider: z.ZodString;
    findings: z.ZodArray<z.ZodObject<{
        class: z.ZodString;
        severity: z.ZodEnum<{
            blocker: "blocker";
            major: "major";
            minor: "minor";
            note: "note";
        }>;
        text: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strict>;
export declare const ReviewColumnSchema: z.ZodObject<{
    column: z.ZodEnum<{
        accessibility: "accessibility";
        adversarial: "adversarial";
        architecture: "architecture";
        browser: "browser";
        component_library: "component_library";
        counterweight: "counterweight";
        criteria_forward: "criteria_forward";
        criteria_reverse: "criteria_reverse";
        diffaudit: "diffaudit";
        ledger: "ledger";
        performance: "performance";
        security: "security";
        tests: "tests";
    }>;
    findings: z.ZodArray<z.ZodObject<{
        severity: z.ZodEnum<{
            blocker: "blocker";
            major: "major";
            minor: "minor";
            note: "note";
        }>;
        text: z.ZodString;
        path: z.ZodOptional<z.ZodString>;
        line: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strict>;
export interface EvidenceKindDef {
    schema: z.ZodTypeAny;
    remedy: string;
    describe: string;
}
export declare const EVIDENCE_KINDS: Record<EvidenceKind, EvidenceKindDef>;
export declare function isEvidenceKind(s: string): s is EvidenceKind;
