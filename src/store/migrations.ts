import { STATE_SCHEMA, UnitStateSchema } from './schema.js';
import type { UnitState } from './state.js';

export class UnknownSchemaError extends Error {
  constructor(public readonly schema: unknown) {
    super(`unknown state schema: ${JSON.stringify(schema)}`);
    this.name = 'UnknownSchemaError';
  }
}

type Raw = Record<string, unknown>;
type Step = (raw: Raw) => Raw;

function isRecord(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Schema 0 is the synthetic pre-release shape: the stage lived under a
 * differently named key and most collections were optional.
 */
const from0: Step = (raw) => {
  const { phaseName, ...rest } = raw; // harness-lint: allow
  const stage = rest.stage ?? phaseName ?? 'scope'; // harness-lint: allow
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

/** Stage names from the ten-stage 0.1.0 pipeline mapped onto the six-stage one. */
const STAGE_RENAMES: Record<string, string> = { plan: 'build', commit: 'build', revise: 'build', challenge: 'review' };

function renameStage(v: unknown): unknown {
  return typeof v === 'string' ? (STAGE_RENAMES[v] ?? v) : v;
}

/** Map old stage names in `stage` and every timer onto the current pipeline. */
export function normalizeStages(raw: Raw): Raw {
  const timers = Array.isArray(raw.timers) ? raw.timers.map((t) => (isRecord(t) ? { ...t, stage: renameStage(t.stage) } : t)) : raw.timers;
  return { ...raw, stage: renameStage(raw.stage), timers };
}

/** `n → n+1` steps keyed by the schema they upgrade from. */
export const MIGRATIONS: Record<number, Step> = { 0: from0 };

/** Lift any known state shape to the current schema and validate it. */
export function migrate(raw: unknown): UnitState {
  if (!isRecord(raw)) throw new UnknownSchemaError(raw);
  let current: Raw = raw;
  const initial = current.schema;
  if (typeof initial !== 'number' || !Number.isInteger(initial) || initial < 0 || initial > STATE_SCHEMA) {
    throw new UnknownSchemaError(initial);
  }
  let schema: number = initial;
  while (schema < STATE_SCHEMA) {
    const step = MIGRATIONS[schema];
    if (!step) throw new UnknownSchemaError(schema);
    current = step(current);
    schema = current.schema as number;
  }
  return UnitStateSchema.parse(normalizeStages(current)) as UnitState;
}
