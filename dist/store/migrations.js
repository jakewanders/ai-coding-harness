import { STATE_SCHEMA, UnitStateSchema } from './schema.js';
export class UnknownSchemaError extends Error {
    schema;
    constructor(schema) {
        super(`unknown state schema: ${JSON.stringify(schema)}`);
        this.schema = schema;
        this.name = 'UnknownSchemaError';
    }
}
function isRecord(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/**
 * Schema 0 is the synthetic pre-release shape: the stage lived under a
 * differently named key and most collections were optional.
 */
const from0 = (raw) => {
    const { phaseName, ...rest } = raw; // harness-lint: allow
    const stage = rest.stage ?? phaseName ?? 'define'; // harness-lint: allow
    const now = new Date().toISOString();
    return {
        schema: 1,
        id: rest.id,
        repo: rest.repo ?? 'local/unknown',
        tracked: rest.tracked ?? false,
        source: rest.source ?? { kind: 'text', ref: null, pinned: false },
        mode: rest.mode ?? 'thorough',
        stage,
        cycle: rest.cycle ?? 0,
        kind: rest.kind ?? 'unknown',
        worktree: rest.worktree ?? null,
        branch: rest.branch ?? null,
        base_branch: rest.base_branch ?? 'main',
        evidence: rest.evidence ?? [],
        commits: rest.commits ?? [],
        runs: rest.runs ?? [],
        pr: rest.pr ?? null,
        timers: rest.timers ?? [],
        answers: rest.answers ?? {},
        challenge_passed: rest.challenge_passed ?? false,
        created_at: rest.created_at ?? now,
        updated_at: rest.updated_at ?? now,
    };
};
/**
 * Stage names from earlier pipelines mapped onto the current six-stage one:
 * the ten-stage 0.1.0 names (plan, commit, revise, challenge) and the
 * pre-rename ids scope, verify, publish and close.
 */
const STAGE_RENAMES = {
    plan: 'build', commit: 'build', revise: 'build', challenge: 'review',
    scope: 'define', verify: 'walkthrough', publish: 'pr', close: 'wrap_up',
};
function renameStage(v) {
    return typeof v === 'string' ? (STAGE_RENAMES[v] ?? v) : v;
}
/** Map old stage names in `stage`, every timer and every report onto the current pipeline. */
export function normalizeStages(raw) {
    const timers = Array.isArray(raw.timers) ? raw.timers.map((t) => (isRecord(t) ? { ...t, stage: renameStage(t.stage) } : t)) : raw.timers;
    const out = { ...raw, stage: renameStage(raw.stage), timers };
    if (isRecord(raw.reports)) {
        const reports = {};
        for (const [key, list] of Object.entries(raw.reports)) {
            const stage = renameStage(key);
            const items = Array.isArray(list) ? list.map((r) => (isRecord(r) ? { ...r, stage: renameStage(r.stage) } : r)) : list;
            const prior = reports[stage];
            reports[stage] = Array.isArray(prior) && Array.isArray(items) ? [...prior, ...items] : items;
        }
        out.reports = reports;
    }
    return out;
}
/** Schema 1 → 2: stage ids scope, verify, publish, close became define, walkthrough, pr, wrap_up. */
const from1 = (raw) => ({ ...normalizeStages(raw), schema: 2 });
/** `n → n+1` steps keyed by the schema they upgrade from. */
export const MIGRATIONS = { 0: from0, 1: from1 };
/** Lift any known state shape to the current schema and validate it. */
export function migrate(raw) {
    if (!isRecord(raw))
        throw new UnknownSchemaError(raw);
    let current = raw;
    const initial = current.schema;
    if (typeof initial !== 'number' || !Number.isInteger(initial) || initial < 0 || initial > STATE_SCHEMA) {
        throw new UnknownSchemaError(initial);
    }
    let schema = initial;
    while (schema < STATE_SCHEMA) {
        const step = MIGRATIONS[schema];
        if (!step)
            throw new UnknownSchemaError(schema);
        current = step(current);
        schema = current.schema;
    }
    return UnitStateSchema.parse(normalizeStages(current));
}
