import type { StageName, UnitState } from './state.js';

export interface Transition {
  state: UnitState;
  from: StageName;
  to: StageName;
  cycleIncremented: boolean;
}

/**
 * Move a unit to `to`: end the open timer, start one for the new stage, and
 * increment the cycle when re-entering review from commit after a revise.
 */
export function applyTransition(state: UnitState, to: StageName, at: string): Transition {
  const from = state.stage;
  const previousStages = state.timers.map((t) => t.stage);
  const cycleIncremented = from === 'commit' && to === 'review' && previousStages.at(-2) === 'revise';
  const next: UnitState = {
    ...state,
    stage: to,
    cycle: cycleIncremented ? state.cycle + 1 : state.cycle,
    timers: [...state.timers.map((t) => (t.ended_at === null ? { ...t, ended_at: at } : t)), { stage: to, started_at: at, ended_at: null, idle_gaps_ms: 0 }],
  };
  return { state: next, from, to, cycleIncremented };
}
