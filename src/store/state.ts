import fs from 'node:fs';
import path from 'node:path';
import type { EvidenceKind } from '../evidence/kinds.js';
import { migrate } from './migrations.js';
import { expandHome, homeRelative } from './paths.js';
import { STATE_SCHEMA, UnitStateSchema } from './schema.js';

export { STATE_SCHEMA };
export { appendHistory } from './history.js';

export type StageName = 'define' | 'build' | 'review' | 'walkthrough' | 'pr' | 'wrap_up';
export type UnitKind = 'feature' | 'bug' | 'chore' | 'unknown';
export type SourceKind = 'ticket' | 'pr' | 'url' | 'file' | 'conversation' | 'text';
export type ReviewVerdict = 'ship' | 'needs_attention' | 'not_ready';

export interface RunRecord { id: string; command: string; exit: number; summary: string; log: string; started_at: string; ended_at: string; cycle?: number }
export interface CommitRecord { sha: string; message: string; at: string; cycle: number }
export interface Thread { id: string; author: string; body: string; path?: string; line?: number; resolved: boolean }
export interface PrRecord { url: string; number: number | null; base: string; head: string; opened_at: string; threads: Thread[] }
export interface TimerRecord { stage: StageName; started_at: string; ended_at: string | null; idle_gaps_ms: number }
export interface EvidenceRecord { kind: EvidenceKind; cycle: number; recorded_at: string; payload: unknown }
export interface Report {
  stage: string; cycle: number; outcome: 'done' | 'blocked' | 'failed'; summary: string; questions: string[]
  verdict?: ReviewVerdict; artifacts: Record<string, string>; at: string
}

export interface UnitState {
  schema: 2; id: string; repo: string; tracked: boolean
  source: { kind: SourceKind; ref: string | null; pinned: boolean }
  mode: string; stage: StageName; cycle: number; kind: UnitKind
  worktree: string | null; branch: string | null; base_branch: string
  evidence: EvidenceRecord[]; commits: CommitRecord[]; runs: RunRecord[]
  pr: PrRecord | null; timers: TimerRecord[]; answers: Record<string, string>
  challenge_passed: boolean; created_at: string; updated_at: string
  reports?: Record<string, Report[]>
  reviews?: Record<number, ReviewVerdict>
  bot?: { round: number; status: string; threads: Thread[] }
  /** Batch siblings: other unit ids run in the same batch group. */
  siblings?: string[]
}

export const STATE_FILE = 'state.json';

export function createState(
  init: Pick<UnitState, 'id' | 'repo' | 'tracked' | 'source' | 'mode' | 'base_branch'>,
  now: () => Date = () => new Date(),
): UnitState {
  const at = now().toISOString();
  return {
    schema: STATE_SCHEMA,
    id: init.id,
    repo: init.repo,
    tracked: init.tracked,
    source: { ...init.source },
    mode: init.mode,
    stage: 'define',
    cycle: 0,
    kind: 'unknown',
    worktree: null,
    branch: null,
    base_branch: init.base_branch,
    evidence: [],
    commits: [],
    runs: [],
    pr: null,
    timers: [],
    answers: {},
    challenge_passed: false,
    created_at: at,
    updated_at: at,
  };
}

function statePath(dir: string): string {
  return path.join(dir, STATE_FILE);
}

/** Read state.json, migrating an old schema in memory and writing it back. */
export function readState(dir: string): UnitState {
  const raw: unknown = JSON.parse(fs.readFileSync(statePath(dir), 'utf8'));
  const needsRewrite = !(typeof raw === 'object' && raw !== null && (raw as { schema?: unknown }).schema === STATE_SCHEMA);
  const migrated = migrate(raw);
  const state: UnitState = { ...migrated, worktree: migrated.worktree ? expandHome(migrated.worktree) : null };
  if (needsRewrite) writeState(dir, state, () => new Date(state.updated_at));
  return state;
}

/** Validate and write state.json with home-relative paths and a fresh updated_at. */
export function writeState(dir: string, s: UnitState, now: () => Date = () => new Date()): void {
  const serial: UnitState = {
    ...s,
    updated_at: now().toISOString(),
    worktree: s.worktree ? homeRelative(s.worktree) : null,
  };
  UnitStateSchema.parse(serial);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath(dir), JSON.stringify(serial, null, 2) + '\n');
}
