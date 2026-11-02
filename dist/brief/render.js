import fs from 'node:fs';
import path from 'node:path';
import { demotionsOf, resolveMode, UnknownModeError } from '../modes.js';
import { BRIEF_CONTRACT, renderHeader } from '../contracts/header.js';
import { stageEntry } from '../registry/stages.js';
import { homeRelative } from '../store/paths.js';
import { readSource } from '../store/units.js';
import { buildSeatBlock, seatWiring } from './seats.js';
export const STOP_BANNER = 'Stop after this stage and report to the user.';
export const NO_UNIT = '(none)';
export function buildHeader(h) {
    const repo = h.state?.repo ?? h.namespace;
    const capabilities = (h.config.config.repos?.[repo]?.capabilities ?? {});
    return {
        contract: BRIEF_CONTRACT,
        unit: h.state?.id ?? NO_UNIT,
        mode: h.state?.mode ?? 'thorough',
        stage: h.stage,
        repo,
        worktree: h.state?.worktree ? homeRelative(h.state.worktree) : null,
        base_branch: h.state?.base_branch ?? h.baseBranch ?? 'main',
        root: h.root,
        seats: seatWiring(h.config.config),
        capabilities,
        gates: h.gates.map((g) => ({ id: g.id, severity: g.severity, status: g.status })),
        docs: h.docs ?? [],
        config_errors: h.config.errors,
    };
}
function configErrorBlock(errors) {
    if (!errors.length)
        return [];
    const lines = ['## Configuration problems', '', 'These layers were skipped; fix them before relying on their settings.', ''];
    for (const e of errors) {
        const where = e.line === null ? e.file : `${e.file}:${e.line}`;
        const at = e.path ? ` at \`${e.path}\`` : '';
        const valid = e.valid_keys?.length ? ` (valid keys: ${e.valid_keys.join(', ')})` : '';
        lines.push(`- ${where}${at}: ${e.message}${valid}`);
    }
    lines.push('');
    return lines;
}
function sourceBlock(ctx) {
    const lines = ['## Source', ''];
    const pinned = ctx.unitDir ? readSource(ctx.unitDir) : null;
    if (pinned === null) {
        const ref = ctx.state?.source.ref;
        lines.push(ref ? `no pinned source; fetch \`${ref}\` (${ctx.state?.source.kind}) through the tracker seat and pin it with \`spec pin\`.` : 'no pinned source.');
    }
    else {
        lines.push(pinned.trimEnd());
    }
    lines.push('');
    return lines;
}
function modeOf(ctx) {
    try {
        return resolveMode(ctx.header.mode, ctx.config.config);
    }
    catch (e) {
        if (e instanceof UnknownModeError)
            return resolveMode('thorough', ctx.config.config);
        throw e;
    }
}
/** `## Mode`: name, demotions, skipped stages, ordering notes, banner, and the stage's mode notes when shipped. */
export function modeBlock(ctx, mode = modeOf(ctx)) {
    const lines = ['## Mode', '', `Run mode: **${mode.name}**${mode.extends ? ` (extends ${mode.extends})` : ''}.`];
    if (mode.banner)
        lines.push('', `> **${mode.banner}**`);
    const demotions = demotionsOf(mode);
    if (demotions.length)
        lines.push('', 'Gate demotions in this mode (every one is listed in the PR body):', ...demotions.map((d) => `- ${d.gate} → ${d.to}`));
    if (mode.skip_stages.length)
        lines.push('', `Skipped stages: ${mode.skip_stages.join(', ')}.`);
    if (mode.merge_dispatches)
        lines.push('', 'Specialist review columns are merged into one dispatch.');
    if (mode.walkthrough_after_pr)
        lines.push('', 'The walkthrough runs after the PR stage in this mode.');
    const notes = path.join(ctx.root, 'skills', ctx.header.stage, 'modes', `${mode.name}.md`);
    if (fs.existsSync(notes))
        lines.push('', `Mode notes for this stage: @root/skills/${ctx.header.stage}/modes/${mode.name}.md — read them before starting.`);
    return lines;
}
/** Full brief: header, seats, config problems, mode, source, stage material, stop banner. */
export function renderBrief(ctx) {
    const entry = stageEntry(ctx.header.stage);
    if (!entry)
        throw new Error(`unknown stage "${ctx.header.stage}"`);
    const parts = [renderHeader(ctx.header), '', buildSeatBlock(ctx.config.config), ''];
    parts.push(...configErrorBlock(ctx.config.errors));
    parts.push(...modeBlock(ctx), '');
    parts.push(...sourceBlock(ctx));
    parts.push(entry.render(ctx).trimEnd(), '');
    if (!ctx.quiet)
        parts.push(`**${STOP_BANNER}**`, '');
    return parts.join('\n').trimEnd() + '\n';
}
