/** Evidence records of `kind` recorded in the unit's current cycle. */
export function recordsThisCycle(ctx, kind) {
    return ctx.state.evidence.filter((e) => e.kind === kind && e.cycle === ctx.state.cycle);
}
/** Is there a waiver for `gate` (any cycle; waivers travel with the unit)? */
export function waived(ctx, gate) {
    return ctx.state.evidence.some((e) => e.kind === 'waiver' && e.payload?.gate === gate);
}
