import { z } from 'zod';
import { EVIDENCE_KIND_NAMES } from '../evidence/kinds.js';
export const STATE_SCHEMA = 2;
export const STAGE_NAMES = ['define', 'build', 'review', 'walkthrough', 'pr', 'wrap_up'];
export const UNIT_KINDS = ['feature', 'bug', 'chore', 'unknown'];
export const SOURCE_KINDS = ['ticket', 'pr', 'url', 'file', 'conversation', 'text'];
export const REVIEW_VERDICTS = ['ship', 'needs_attention', 'not_ready'];
export const REPORT_OUTCOMES = ['done', 'blocked', 'failed'];
const iso = z.string().min(1);
export const ThreadSchema = z.object({
    id: z.string(),
    author: z.string(),
    body: z.string(),
    path: z.string().optional(),
    line: z.number().int().optional(),
    resolved: z.boolean(),
});
export const RunRecordSchema = z.object({
    id: z.string(),
    command: z.string(),
    exit: z.number().int(),
    summary: z.string(),
    log: z.string(),
    started_at: iso,
    ended_at: iso,
    cycle: z.number().int().nonnegative().optional(),
});
export const CommitRecordSchema = z.object({
    sha: z.string(),
    message: z.string(),
    at: iso,
    cycle: z.number().int().nonnegative(),
});
export const PrRecordSchema = z.object({
    url: z.string(),
    number: z.number().int().nullable(),
    base: z.string(),
    head: z.string(),
    opened_at: iso,
    threads: z.array(ThreadSchema),
});
export const TimerRecordSchema = z.object({
    stage: z.enum(STAGE_NAMES),
    started_at: iso,
    ended_at: iso.nullable(),
    idle_gaps_ms: z.number().nonnegative(),
});
export const EvidenceRecordSchema = z.object({
    kind: z.enum(EVIDENCE_KIND_NAMES),
    cycle: z.number().int().nonnegative(),
    recorded_at: iso,
    payload: z.unknown(),
});
export const ReportSchema = z.object({
    stage: z.string(),
    cycle: z.number().int().nonnegative(),
    outcome: z.enum(REPORT_OUTCOMES),
    summary: z.string(),
    questions: z.array(z.string()),
    verdict: z.enum(REVIEW_VERDICTS).optional(),
    artifacts: z.record(z.string(), z.string()),
    at: iso,
});
export const UnitStateSchema = z.object({
    schema: z.literal(STATE_SCHEMA),
    id: z.string().min(1),
    repo: z.string().min(1),
    tracked: z.boolean(),
    source: z.object({
        kind: z.enum(SOURCE_KINDS),
        ref: z.string().nullable(),
        pinned: z.boolean(),
    }),
    mode: z.string().min(1),
    stage: z.enum(STAGE_NAMES),
    cycle: z.number().int().nonnegative(),
    kind: z.enum(UNIT_KINDS),
    worktree: z.string().nullable(),
    branch: z.string().nullable(),
    base_branch: z.string().min(1),
    evidence: z.array(EvidenceRecordSchema),
    commits: z.array(CommitRecordSchema),
    runs: z.array(RunRecordSchema),
    pr: PrRecordSchema.nullable(),
    timers: z.array(TimerRecordSchema),
    answers: z.record(z.string(), z.string()),
    challenge_passed: z.boolean(),
    created_at: iso,
    updated_at: iso,
    reports: z.record(z.string(), z.array(ReportSchema)).optional(),
    reviews: z.record(z.string(), z.enum(REVIEW_VERDICTS)).optional(),
    bot: z
        .object({ round: z.number().int().nonnegative(), status: z.string(), threads: z.array(ThreadSchema) })
        .optional(),
    siblings: z.array(z.string()).optional(),
});
