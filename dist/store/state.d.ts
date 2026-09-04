import type { EvidenceKind } from '../evidence/kinds.js';
import { STATE_SCHEMA } from './schema.js';
export { STATE_SCHEMA };
export { appendHistory } from './history.js';
export type StageName = 'scope' | 'plan' | 'build' | 'commit' | 'review' | 'revise' | 'challenge' | 'verify' | 'publish' | 'close';
export type UnitKind = 'feature' | 'bug' | 'chore' | 'unknown';
export type SourceKind = 'ticket' | 'pr' | 'url' | 'file' | 'conversation' | 'text';
export type ReviewVerdict = 'ship' | 'needs_attention' | 'not_ready';
export interface RunRecord {
    id: string;
    command: string;
    exit: number;
    summary: string;
    log: string;
    started_at: string;
    ended_at: string;
}
export interface CommitRecord {
    sha: string;
    message: string;
    at: string;
    cycle: number;
}
export interface Thread {
    id: string;
    author: string;
    body: string;
    path?: string;
    line?: number;
    resolved: boolean;
}
export interface PrRecord {
    url: string;
    number: number | null;
    base: string;
    head: string;
    opened_at: string;
    threads: Thread[];
}
export interface TimerRecord {
    stage: StageName;
    started_at: string;
    ended_at: string | null;
    idle_gaps_ms: number;
}
export interface EvidenceRecord {
    kind: EvidenceKind;
    cycle: number;
    recorded_at: string;
    payload: unknown;
}
export interface Report {
    stage: string;
    cycle: number;
    outcome: 'done' | 'blocked' | 'failed';
    summary: string;
    questions: string[];
    verdict?: ReviewVerdict;
    artifacts: Record<string, string>;
    at: string;
}
export interface UnitState {
    schema: 1;
    id: string;
    repo: string;
    tracked: boolean;
    source: {
        kind: SourceKind;
        ref: string | null;
        pinned: boolean;
    };
    mode: string;
    stage: StageName;
    cycle: number;
    kind: UnitKind;
    worktree: string | null;
    branch: string | null;
    base_branch: string;
    evidence: EvidenceRecord[];
    commits: CommitRecord[];
    runs: RunRecord[];
    pr: PrRecord | null;
    timers: TimerRecord[];
    answers: Record<string, string>;
    challenge_passed: boolean;
    created_at: string;
    updated_at: string;
    reports?: Record<string, Report[]>;
    reviews?: Record<number, ReviewVerdict>;
    bot?: {
        round: number;
        status: string;
        threads: Thread[];
    };
}
export declare const STATE_FILE = "state.json";
export declare function createState(init: Pick<UnitState, 'id' | 'repo' | 'tracked' | 'source' | 'mode' | 'base_branch'>, now?: () => Date): UnitState;
/** Read state.json, migrating an old schema in memory and writing it back. */
export declare function readState(dir: string): UnitState;
/** Validate and write state.json with home-relative paths and a fresh updated_at. */
export declare function writeState(dir: string, s: UnitState, now?: () => Date): void;
