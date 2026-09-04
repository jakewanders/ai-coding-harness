import type { StageName, TimerRecord } from '../store/state.js';

export const DEFAULT_IDLE_GAP_MS = 15 * 60 * 1000;

export interface WorklogGap {
  after: StageName;
  before: StageName;
  minutes: number;
}

export interface Worklog {
  stages: Array<{ stage: StageName; minutes: number }>;
  total_minutes: number;
  idle_minutes: number;
  gaps: WorklogGap[];
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Minutes per stage from the timers, minus idle gaps recorded inside each
 * timer; gaps between consecutive timers longer than `idleGapMs` are reported
 * as idle. Open timers count up to `now`.
 */
export function suggestWorklog(timers: TimerRecord[], idleGapMs: number = DEFAULT_IDLE_GAP_MS, now: Date = new Date()): Worklog {
  const perStage = new Map<StageName, number>();
  let idleMs = 0;
  const gaps: WorklogGap[] = [];
  const ordered = [...timers].sort((a, b) => ms(a.started_at) - ms(b.started_at));

  ordered.forEach((t, i) => {
    const end = t.ended_at ? ms(t.ended_at) : now.getTime();
    const active = Math.max(0, end - ms(t.started_at) - t.idle_gaps_ms);
    idleMs += Math.min(t.idle_gaps_ms, Math.max(0, end - ms(t.started_at)));
    perStage.set(t.stage, (perStage.get(t.stage) ?? 0) + active);
    const next = ordered[i + 1];
    if (next && t.ended_at) {
      const gap = ms(next.started_at) - ms(t.ended_at);
      if (gap > idleGapMs) {
        idleMs += gap;
        gaps.push({ after: t.stage, before: next.stage, minutes: Math.round(gap / 60_000) });
      }
    }
  });

  const stages = [...perStage.entries()].map(([stage, msActive]) => ({ stage, minutes: Math.round(msActive / 60_000) }));
  return { stages, total_minutes: stages.reduce((n, s) => n + s.minutes, 0), idle_minutes: Math.round(idleMs / 60_000), gaps };
}

/**
 * Attribute the time since the last recorded activity to the open timer as
 * idle when it exceeds the threshold. Returns the updated timers.
 */
export function recordActivity(timers: TimerRecord[], lastActivityIso: string, now: Date, idleGapMs: number = DEFAULT_IDLE_GAP_MS): TimerRecord[] {
  const gap = now.getTime() - ms(lastActivityIso);
  if (gap <= idleGapMs) return timers;
  return timers.map((t) => (t.ended_at === null ? { ...t, idle_gaps_ms: t.idle_gaps_ms + gap } : t));
}
