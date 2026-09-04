import fs from 'node:fs';
import path from 'node:path';
import { inferProfile } from '../config/infer.js';
import { parseRequirement } from '../spec/requirement.js';
import { readIndex, searchIndex } from '../store/index.js';
import { openEntries, readLedger } from '../store/ledger.js';
const PLAN_CAP = 6000;
function readIf(file) {
    return file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
function requirementSection(ctx) {
    const md = readIf(ctx.unitDir ? path.join(ctx.unitDir, 'requirement.md') : null);
    const req = md === null ? null : parseRequirement(md);
    const lines = ['## Requirement', ''];
    if (!req)
        return [...lines, 'Not recorded yet; scope records it with `spec record` and `spec criteria`.'];
    lines.push(`**${req.title}**${req.url ? ` (${req.url})` : ''}`, '');
    if (req.body)
        lines.push(req.body, '');
    lines.push('Acceptance criteria:', '');
    lines.push(...(req.criteria.length ? req.criteria.map((c) => `- ${c.id}: ${c.text}`) : ['- none recorded']));
    return lines;
}
function planSection(ctx) {
    const md = readIf(ctx.unitDir ? path.join(ctx.unitDir, 'plan.md') : null);
    if (md === null)
        return ['## Plan', '', 'No plan.md yet.'];
    const body = md.trim();
    return ['## Plan', '', body.length > PLAN_CAP ? `${body.slice(0, PLAN_CAP)}\n\n[plan truncated; read plan.md in the unit directory]` : body];
}
function reviewSection(ctx) {
    const state = ctx.state;
    if (!state || !ctx.unitDir)
        return ['## Latest review', '', 'No unit.'];
    const cycles = fs.existsSync(path.join(ctx.unitDir, 'reviews'))
        ? fs.readdirSync(path.join(ctx.unitDir, 'reviews')).map((f) => /^cycle-(\d+)\.json$/.exec(f)?.[1]).filter((n) => Boolean(n)).map(Number).sort((a, b) => b - a)
        : [];
    const lines = ['## Latest review', ''];
    if (!cycles.length) {
        const columns = state.evidence.filter((e) => e.kind === 'review_column' && e.cycle === state.cycle);
        lines.push(columns.length ? `${columns.length} review column(s) recorded this cycle; no synthesized verdict yet.` : 'No review recorded yet.');
        return lines;
    }
    const latest = cycles[0];
    try {
        const review = JSON.parse(fs.readFileSync(path.join(ctx.unitDir, 'reviews', `cycle-${latest}.json`), 'utf8'));
        lines.push(`Cycle ${latest}: verdict ${review.verdict ?? 'unknown'}${review.counts ? ` (${Object.entries(review.counts).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}.`);
    }
    catch {
        lines.push(`Cycle ${latest}: review file unreadable.`);
    }
    return lines;
}
function commandsSection(ctx) {
    const repo = ctx.state?.repo ?? ctx.header.repo;
    const configured = ctx.config.config.repos?.[repo]?.commands ?? {};
    const entries = Object.entries(configured).filter(([, v]) => typeof v === 'string' && v.trim());
    const lines = ['## Repo commands', ''];
    if (entries.length) {
        lines.push(...entries.map(([k, v]) => `- ${k}: \`${v}\``));
        return lines;
    }
    const dir = ctx.state?.worktree ?? ctx.cwd ?? null;
    const guesses = dir ? inferProfile(dir).guesses.filter((g) => g.field.startsWith('commands.')) : [];
    if (!guesses.length)
        return [...lines, 'None configured or inferable; propose them in plan.md under `## Commands`.'];
    lines.push('Inferred (not configured):', '', ...guesses.map((g) => `- ${g.field.slice('commands.'.length)}: \`${g.value}\` — ${g.evidence}`));
    return lines;
}
function decisionsSection(ctx) {
    const lines = ['## Prior decisions', ''];
    const md = readIf(ctx.unitDir ? path.join(ctx.unitDir, 'requirement.md') : null);
    const req = md === null ? null : parseRequirement(md);
    const query = [req?.title ?? '', ...(req?.criteria.map((c) => c.text) ?? [])].join(' ').trim();
    if (!query)
        return [...lines, 'Nothing to search yet (no requirement).'];
    const hits = searchIndex(readIndex(ctx.vault), query, { repo: ctx.state?.repo ?? ctx.header.repo, limit: 3 }).filter((h) => h.id !== ctx.state?.id);
    if (!hits.length)
        return [...lines, 'No related digests found; `recall search` with other terms if you suspect prior work.'];
    for (const h of hits) {
        lines.push(`- ${h.id}: ${h.summary}`);
        for (const d of h.decisions.slice(0, 3))
            lines.push(`  - ${d}`);
    }
    return lines;
}
function ledgerSection(ctx) {
    const repo = ctx.state?.repo ?? ctx.header.repo;
    const entries = openEntries(readLedger(ctx.vault, repo));
    const lines = ['## Ledger', ''];
    if (!entries.length)
        return [...lines, 'No carry-forward entries for this repo.'];
    lines.push('Carry-forward entries to re-verify against this unit (`ledger recheck` each one):', '');
    for (const e of entries)
        lines.push(`- ${e.id} [${e.kind}] ${e.text}${e.last_checked_unit === ctx.state?.id ? ' — rechecked by this unit' : ''}`);
    return lines;
}
const SECTION_RENDERERS = {
    requirement: requirementSection,
    plan: planSection,
    review: reviewSection,
    commands: commandsSection,
    decisions: decisionsSection,
    ledger: ledgerSection,
};
/** Heading, purpose, stage sections, produces, call templates, follow-up. */
export function stageBrief(info, ctx, body = []) {
    const id = ctx.state?.id ?? ctx.header.unit;
    const lines = [`# ${info.name}`, '', info.purpose, ''];
    if (body.length)
        lines.push(...body, '');
    for (const section of info.sections)
        lines.push(...SECTION_RENDERERS[section](ctx), '');
    lines.push('## Produces', '', ...info.outputs.map((o) => `- ${o}`), '');
    const calls = info.calls(id);
    if (calls.length)
        lines.push('## Calls', '', '```harness', ...calls, '```', '');
    lines.push('## Next', '', `When this stage is complete, call \`unit advance\` with id \`${id}\`. If it refuses, follow the remedies it lists,`, `then call \`unit brief\` with id \`${id}\` for the next stage's brief.`);
    return lines.join('\n');
}
/** Brief for a standalone flow whose renderer has not landed yet. */
export function flowStub(name) {
    return () => `# ${name}\n\nStandalone flow \`${name}\`; follow its skill as written. The engine keeps no unit state for this brief unless one is named.`;
}
