import { demotionsOf } from '../modes.js';
/** Bullets under a `## Deferred` heading in plan.md. */
export function parseDeferred(plan) {
    if (!plan)
        return [];
    const lines = plan.split(/\r?\n/);
    const start = lines.findIndex((l) => /^##\s+Deferred\s*$/i.test(l.trim()));
    if (start < 0)
        return [];
    const out = [];
    for (const line of lines.slice(start + 1)) {
        if (/^#{1,6}\s/.test(line))
            break;
        const m = /^\s*[-*]\s+(.+)$/.exec(line);
        if (m)
            out.push(m[1].trim());
    }
    return out;
}
function latest(state, kind) {
    return state.evidence.filter((e) => e.kind === kind).at(-1);
}
function latestThisCycle(state, kind) {
    return state.evidence.filter((e) => e.kind === kind && e.cycle === state.cycle).at(-1) ?? latest(state, kind);
}
function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}
export function scopeLedger(state, requirement) {
    const results = (latestThisCycle(state, 'criteria_validation')?.payload?.results ?? []);
    const byId = new Map(results.map((r) => [r.criterion, r]));
    const lines = ['## Scope ledger', '', '| Criterion | Proof | Status |', '|---|---|---|'];
    const criteria = requirement?.criteria ?? [];
    if (!criteria.length)
        lines.push('| (no acceptance criteria recorded) | | |');
    for (const c of criteria) {
        const v = byId.get(c.id);
        lines.push(`| ${c.id}: ${c.text} | ${v?.proof || '—'} | ${v ? v.status : 'not validated'} |`);
    }
    for (const r of results.filter((r) => !criteria.some((c) => c.id === r.criterion))) {
        lines.push(`| ${r.criterion} (not in requirement) | ${r.proof || '—'} | ${r.status} |`);
    }
    return lines;
}
function evidenceSection(state) {
    const lines = ['## Evidence', ''];
    const critique = latestThisCycle(state, 'self_critique')?.payload;
    lines.push(critique ? `- self-critique: ${plural(critique.findings?.length ?? 0, 'finding')}` : '- self-critique: not recorded');
    const repro = latest(state, 'defect_repro')?.payload;
    if (state.kind === 'bug' || repro) {
        lines.push(repro ? `- defect repro: red ${repro.red_output?.trim() ? 'captured' : 'missing'}, green ${repro.green_output?.trim() ? 'captured' : 'pending'}` : '- defect repro: not recorded');
    }
    const pii = latestThisCycle(state, 'pii')?.payload;
    lines.push(pii ? `- personal-data audit: ${pii.findings?.length ? plural(pii.findings.length, 'finding') : 'clean'}` : '- personal-data audit: not recorded');
    return lines;
}
function waiversSection(state) {
    const waivers = state.evidence.filter((e) => e.kind === 'waiver').map((e) => e.payload);
    return ['## Waivers', '', ...(waivers.length ? waivers.map((w) => `- ${w.gate}: ${w.rationale}`) : ['none'])];
}
export function notBuiltSection(plan) {
    const deferred = parseDeferred(plan);
    return ['## Not built', '', ...(deferred.length ? deferred.map((d) => `- ${d}`) : ['nothing deferred'])];
}
export function modeSection(mode) {
    const demotions = demotionsOf(mode);
    const modeLines = ['## Mode', '', `Run mode: ${mode.name}${mode.extends ? ` (extends ${mode.extends})` : ''}.`];
    if (demotions.length)
        modeLines.push('', 'Gate demotions applied by this mode:', ...demotions.map((d) => `- ${d.gate} → ${d.to}`));
    else
        modeLines.push('', 'No gate demotions.');
    const reduced = demotions.length > 0 || mode.skip_stages.length > 0;
    const notProven = [];
    if (reduced) {
        notProven.push('## Not proven', '', 'This run did not prove:');
        if (mode.skip_stages.length)
            notProven.push(`- stages skipped: ${mode.skip_stages.join(', ')}`);
        for (const d of demotions)
            notProven.push(`- ${d.gate} was ${d.to === 'off' ? 'not enforced' : 'advisory only'}`);
    }
    return { mode: modeLines, notProven };
}
/** The ghostwritten PR body assembled from the unit record. */
export function renderPrBody(state, requirement, mode, opts = {}) {
    const parts = [];
    if (mode.banner)
        parts.push(`> **${mode.banner}**`, '');
    parts.push(`# ${requirement?.title ?? state.id}`, '');
    const summary = requirement?.body?.trim() ? requirement.body.trim() : `Unit ${state.id}${requirement?.url ? ` (${requirement.url})` : ''}.`;
    parts.push('## Summary', '', summary, '');
    if (requirement?.url)
        parts.push(`Source: ${requirement.url}`, '');
    parts.push(...scopeLedger(state, requirement), '');
    parts.push(...evidenceSection(state), '');
    parts.push(...waiversSection(state), '');
    parts.push(...notBuiltSection(opts.plan), '');
    const { mode: modeLines, notProven } = modeSection(mode);
    parts.push(...modeLines, '');
    if (notProven.length)
        parts.push(...notProven, '');
    return parts.join('\n').trimEnd() + '\n';
}
