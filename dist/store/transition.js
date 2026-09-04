/**
 * Move a unit to `to`: end the open timer, start one for the new stage, and
 * increment the cycle each time review starts again after the first time.
 */
export function applyTransition(state, to, at) {
    const from = state.stage;
    const cycleIncremented = to === 'review' && state.timers.some((t) => t.stage === 'review');
    const next = {
        ...state,
        stage: to,
        cycle: cycleIncremented ? state.cycle + 1 : state.cycle,
        timers: [...state.timers.map((t) => (t.ended_at === null ? { ...t, ended_at: at } : t)), { stage: to, started_at: at, ended_at: null, idle_gaps_ms: 0 }],
    };
    return { state: next, from, to, cycleIncremented };
}
