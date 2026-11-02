import { z } from 'zod';
export declare const STATE_SCHEMA = 2;
export declare const STAGE_NAMES: readonly ['define', 'build', 'review', 'walkthrough', 'pr', 'wrap_up'];
export declare const UNIT_KINDS: readonly ['feature', 'bug', 'chore', 'unknown'];
export declare const SOURCE_KINDS: readonly ['ticket', 'pr', 'url', 'file', 'conversation', 'text'];
export declare const REVIEW_VERDICTS: readonly ['ship', 'needs_attention', 'not_ready'];
export declare const REPORT_OUTCOMES: readonly ['done', 'blocked', 'failed'];
export declare const ThreadSchema: z.ZodObject<{
    id: z.ZodString;
    author: z.ZodString;
    body: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
    line: z.ZodOptional<z.ZodNumber>;
    resolved: z.ZodBoolean;
}, z.core.$strip>;
export declare const RunRecordSchema: z.ZodObject<{
    id: z.ZodString;
    command: z.ZodString;
    exit: z.ZodNumber;
    summary: z.ZodString;
    log: z.ZodString;
    started_at: z.ZodString;
    ended_at: z.ZodString;
    cycle: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const CommitRecordSchema: z.ZodObject<{
    sha: z.ZodString;
    message: z.ZodString;
    at: z.ZodString;
    cycle: z.ZodNumber;
}, z.core.$strip>;
export declare const PrRecordSchema: z.ZodObject<{
    url: z.ZodString;
    number: z.ZodNullable<z.ZodNumber>;
    base: z.ZodString;
    head: z.ZodString;
    opened_at: z.ZodString;
    threads: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        author: z.ZodString;
        body: z.ZodString;
        path: z.ZodOptional<z.ZodString>;
        line: z.ZodOptional<z.ZodNumber>;
        resolved: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const TimerRecordSchema: z.ZodObject<{
    stage: z.ZodEnum<{
        build: "build";
        define: "define";
        pr: "pr";
        review: "review";
        walkthrough: "walkthrough";
        wrap_up: "wrap_up";
    }>;
    started_at: z.ZodString;
    ended_at: z.ZodNullable<z.ZodString>;
    idle_gaps_ms: z.ZodNumber;
}, z.core.$strip>;
export declare const EvidenceRecordSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        browser_findings: "browser_findings";
        claims: "claims";
        criteria_validation: "criteria_validation";
        defect_repro: "defect_repro";
        pii: "pii";
        review_column: "review_column";
        screen_verdict: "screen_verdict";
        self_critique: "self_critique";
        waiver: "waiver";
    }>;
    cycle: z.ZodNumber;
    recorded_at: z.ZodString;
    payload: z.ZodUnknown;
}, z.core.$strip>;
export declare const ReportSchema: z.ZodObject<{
    stage: z.ZodString;
    cycle: z.ZodNumber;
    outcome: z.ZodEnum<{
        blocked: "blocked";
        done: "done";
        failed: "failed";
    }>;
    summary: z.ZodString;
    questions: z.ZodArray<z.ZodString>;
    verdict: z.ZodOptional<z.ZodEnum<{
        needs_attention: "needs_attention";
        not_ready: "not_ready";
        ship: "ship";
    }>>;
    artifacts: z.ZodRecord<z.ZodString, z.ZodString>;
    at: z.ZodString;
}, z.core.$strip>;
export declare const UnitStateSchema: z.ZodObject<{
    schema: z.ZodLiteral<2>;
    id: z.ZodString;
    repo: z.ZodString;
    tracked: z.ZodBoolean;
    source: z.ZodObject<{
        kind: z.ZodEnum<{
            conversation: "conversation";
            file: "file";
            pr: "pr";
            text: "text";
            ticket: "ticket";
            url: "url";
        }>;
        ref: z.ZodNullable<z.ZodString>;
        pinned: z.ZodBoolean;
    }, z.core.$strip>;
    mode: z.ZodString;
    stage: z.ZodEnum<{
        build: "build";
        define: "define";
        pr: "pr";
        review: "review";
        walkthrough: "walkthrough";
        wrap_up: "wrap_up";
    }>;
    cycle: z.ZodNumber;
    kind: z.ZodEnum<{
        bug: "bug";
        chore: "chore";
        feature: "feature";
        unknown: "unknown";
    }>;
    worktree: z.ZodNullable<z.ZodString>;
    branch: z.ZodNullable<z.ZodString>;
    base_branch: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            browser_findings: "browser_findings";
            claims: "claims";
            criteria_validation: "criteria_validation";
            defect_repro: "defect_repro";
            pii: "pii";
            review_column: "review_column";
            screen_verdict: "screen_verdict";
            self_critique: "self_critique";
            waiver: "waiver";
        }>;
        cycle: z.ZodNumber;
        recorded_at: z.ZodString;
        payload: z.ZodUnknown;
    }, z.core.$strip>>;
    commits: z.ZodArray<z.ZodObject<{
        sha: z.ZodString;
        message: z.ZodString;
        at: z.ZodString;
        cycle: z.ZodNumber;
    }, z.core.$strip>>;
    runs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        command: z.ZodString;
        exit: z.ZodNumber;
        summary: z.ZodString;
        log: z.ZodString;
        started_at: z.ZodString;
        ended_at: z.ZodString;
        cycle: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    pr: z.ZodNullable<z.ZodObject<{
        url: z.ZodString;
        number: z.ZodNullable<z.ZodNumber>;
        base: z.ZodString;
        head: z.ZodString;
        opened_at: z.ZodString;
        threads: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            author: z.ZodString;
            body: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            line: z.ZodOptional<z.ZodNumber>;
            resolved: z.ZodBoolean;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    timers: z.ZodArray<z.ZodObject<{
        stage: z.ZodEnum<{
            build: "build";
            define: "define";
            pr: "pr";
            review: "review";
            walkthrough: "walkthrough";
            wrap_up: "wrap_up";
        }>;
        started_at: z.ZodString;
        ended_at: z.ZodNullable<z.ZodString>;
        idle_gaps_ms: z.ZodNumber;
    }, z.core.$strip>>;
    answers: z.ZodRecord<z.ZodString, z.ZodString>;
    challenge_passed: z.ZodBoolean;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    reports: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        stage: z.ZodString;
        cycle: z.ZodNumber;
        outcome: z.ZodEnum<{
            blocked: "blocked";
            done: "done";
            failed: "failed";
        }>;
        summary: z.ZodString;
        questions: z.ZodArray<z.ZodString>;
        verdict: z.ZodOptional<z.ZodEnum<{
            needs_attention: "needs_attention";
            not_ready: "not_ready";
            ship: "ship";
        }>>;
        artifacts: z.ZodRecord<z.ZodString, z.ZodString>;
        at: z.ZodString;
    }, z.core.$strip>>>>;
    reviews: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEnum<{
        needs_attention: "needs_attention";
        not_ready: "not_ready";
        ship: "ship";
    }>>>;
    bot: z.ZodOptional<z.ZodObject<{
        round: z.ZodNumber;
        status: z.ZodString;
        threads: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            author: z.ZodString;
            body: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            line: z.ZodOptional<z.ZodNumber>;
            resolved: z.ZodBoolean;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    siblings: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
