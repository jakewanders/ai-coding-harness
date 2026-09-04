import { suggestWorklog } from '../time/worklog.js';
import { modeSection, notBuiltSection, scopeLedger } from './pr-body.js';
/** One row per timed stage, in order of first start, with minutes and commits made during it. */
export function stageTable(state, now = new Date()) {
    const worklog = suggestWorklog(state.timers, undefined, now);
    const minutes = new Map(worklog.stages.map((s) => [s.stage, s.minutes]));
    const rows = [];
    for (const t of [...state.timers].sort((a, b) => a.started_at.localeCompare(b.started_at))) {
        if (rows.some((r) => r.stage === t.stage))
            continue;
        const spans = state.timers.filter((x) => x.stage === t.stage);
        const commits = state.commits.filter((c) => spans.some((s) => c.at >= s.started_at && (s.ended_at === null || c.at <= s.ended_at))).length;
        rows.push({ stage: t.stage, minutes: minutes.get(t.stage) ?? 0, commits, started_at: t.started_at });
    }
    return rows;
}
/** Wrap-up summary at the end of a run. */
export function renderWrapup(state, requirement, mode, opts = {}) {
    const rows = stageTable(state, opts.now);
    const lines = [`# Wrap-up: ${state.id}${requirement ? ` — ${requirement.title}` : ''}`, ''];
    lines.push('## Pull request', '', state.pr ? `${state.pr.url}${state.pr.number !== null ? ` (#${state.pr.number})` : ''} — ${state.pr.head} → ${state.pr.base}` : 'No pull request recorded.', '');
    lines.push('## Stages', '', '| Stage | Minutes | Commits |', '|---|---|---|');
    lines.push(...(rows.length ? rows.map((r) => `| ${r.stage} | ${r.minutes} | ${r.commits} |`) : ['| (no stage timers) | | |']));
    if (state.commits.length)
        lines.push('', 'Commits:', ...state.commits.map((c) => `- ${c.sha.slice(0, 7)} ${c.message}`));
    lines.push('', ...scopeLedger(state, requirement), '');
    lines.push(...notBuiltSection(opts.plan), '');
    const drafts = opts.drafts ?? [];
    lines.push('## Held drafts', '', ...(drafts.length ? drafts.map((d) => `- ${d}`) : ['No held drafts.']), '');
    const { mode: modeLines, notProven } = modeSection(mode);
    lines.push(...modeLines, '');
    if (notProven.length)
        lines.push(...notProven, '');
    return lines.join('\n').trimEnd() + '\n';
}
