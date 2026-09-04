import { inferProfile } from '../config/infer.js';
import { EVIDENCE_KINDS } from '../evidence/kinds.js';
import { defineGate, registerGate } from '../registry/gates.js';
import { recordsThisCycle, waived } from './_shared.js';
/** The configured (or inferred) command for `name`, or null. */
function profileCommand(ctx, name) {
    const configured = ctx.config.repos?.[ctx.state.repo]?.commands ?? {};
    const anyConfigured = Object.values(configured).some((v) => typeof v === 'string' && v.trim());
    if (anyConfigured)
        return configured[name]?.trim() || null;
    const dir = ctx.worktree ?? ctx.cwd;
    if (!dir)
        return null;
    const guess = inferProfile(dir).guesses.find((g) => g.field === `commands.${name}`);
    return guess?.value ?? null;
}
export const checkCommandGreen = registerGate(defineGate({
    id: 'check_command_green',
    stage: 'commit',
    description: 'The latest check run (or test run when no check command exists) in this cycle exited 0.',
    severity: 'block',
    check: (ctx) => {
        const check = profileCommand(ctx, 'check');
        const test = check ? null : profileCommand(ctx, 'test');
        const wanted = check ?? test;
        const thisCycle = ctx.state.runs.filter((r) => (r.cycle ?? ctx.state.cycle) === ctx.state.cycle);
        const candidates = wanted ? thisCycle.filter((r) => r.command.trim() === wanted) : thisCycle;
        const latest = candidates.at(-1);
        const label = check ? `check command (${check})` : test ? `test command (${test})` : 'a command';
        if (!latest)
            return { pass: false, remedy: `run the ${label} through exec run in this cycle so its result is recorded` };
        if (latest.exit !== 0)
            return { pass: false, remedy: `the latest ${label} run exited ${latest.exit}; fix it and run it again through exec run (log ${latest.log})` };
        return { pass: true };
    },
}));
export const selfCritiqueRecorded = registerGate(defineGate({
    id: 'self_critique_recorded',
    stage: 'commit',
    description: 'A self_critique evidence record exists for this cycle (an empty findings list is valid).',
    severity: 'block',
    check: (ctx) => (recordsThisCycle(ctx, 'self_critique').length ? { pass: true } : { pass: false, remedy: EVIDENCE_KINDS.self_critique.remedy }),
}));
export const defectReproBeforeFix = registerGate(defineGate({
    id: 'defect_repro_before_fix',
    stage: 'commit',
    description: 'Bug-shaped units carry a defect_repro record with verbatim red output, or a written waiver.',
    severity: 'block',
    check: (ctx) => {
        if (ctx.state.kind !== 'bug')
            return { pass: true, applicable: false };
        if (waived(ctx, 'defect_repro_before_fix'))
            return { pass: true };
        const repro = ctx.state.evidence.filter((e) => e.kind === 'defect_repro');
        if (repro.some((e) => (e.payload?.red_output ?? '').trim().length > 0))
            return { pass: true };
        const remedy = repro.length
            ? 'the defect_repro record has empty red_output; capture the failing test output before the fix, or record a waiver for defect_repro_before_fix with a rationale'
            : `${EVIDENCE_KINDS.defect_repro.remedy}, or record a waiver for defect_repro_before_fix with a rationale`;
        return { pass: false, remedy };
    },
}));
export const piiAuditClean = registerGate(defineGate({
    id: 'pii_audit_clean',
    stage: 'commit',
    description: 'A pii record for this cycle reports zero findings, or a waiver explains why findings are acceptable.',
    severity: 'block',
    check: (ctx) => {
        if (waived(ctx, 'pii_audit_clean'))
            return { pass: true };
        const records = recordsThisCycle(ctx, 'pii');
        const latest = records.at(-1);
        if (!latest)
            return { pass: false, remedy: EVIDENCE_KINDS.pii.remedy };
        const findings = latest.payload?.findings ?? [];
        if (findings.length === 0)
            return { pass: true };
        return { pass: false, remedy: `the pii audit has ${findings.length} finding(s); remove the personal-data flow, or record a waiver for pii_audit_clean with a rationale` };
    },
}));
