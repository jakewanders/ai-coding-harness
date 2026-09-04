import type { StageName, TimerRecord } from '../store/state.js';
export declare const DEFAULT_IDLE_GAP_MS: number;
export interface WorklogGap {
    after: StageName;
    before: StageName;
    minutes: number;
}
export interface Worklog {
    stages: Array<{
        stage: StageName;
        minutes: number;
    }>;
    total_minutes: number;
    idle_minutes: number;
    gaps: WorklogGap[];
}
/**
 * Minutes per stage from the timers, minus idle gaps recorded inside each
 * timer; gaps between consecutive timers longer than `idleGapMs` are reported
 * as idle. Open timers count up to `now`.
 */
export declare function suggestWorklog(timers: TimerRecord[], idleGapMs?: number, now?: Date): Worklog;
/**
 * Attribute the time since the last recorded activity to the open timer as
 * idle when it exceeds the threshold. Returns the updated timers.
 */
export declare function recordActivity(timers: TimerRecord[], lastActivityIso: string, now: Date, idleGapMs?: number): TimerRecord[];
