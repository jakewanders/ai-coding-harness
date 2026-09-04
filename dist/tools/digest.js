import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { envelope } from '../contracts/envelope.js';
import '../gates/index.js';
import { resolveMode, UnknownModeError } from '../modes.js';
import { action, defineTool, fail, result } from '../registry/tools.js';
import { parseRequirement } from '../spec/requirement.js';
import { entryFor, parseDigest, renderDigest, upsertEntry } from '../store/index.js';
import { appendHistory } from '../store/state.js';
import { loadUnit } from '../store/units.js';
import { renderWrapup, stageTable } from '../text/wrapup.js';
function withUnit(ctx, id, fn) {
    const unit = loadUnit(ctx, id);
    if (!unit)
        return fail(`unit "${id}" not found in the current namespace`);
    return fn(unit);
}
function readIf(file) {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
export function readDigest(dir) {
    const md = readIf(path.join(dir, 'digest.md'));
    return md === null ? null : parseDigest(md);
}
function requirementOf(dir) {
    const md = readIf(path.join(dir, 'requirement.md'));
    return md === null ? null : parseRequirement(md);
}
function modeOf(unit, ctx) {
    try {
        return resolveMode(unit.state.mode, ctx.config.config);
    }
    catch (e) {
        if (!(e instanceof UnknownModeError))
            throw e;
        return resolveMode('thorough', ctx.config.config);
    }
}
export const digestTool = defineTool({
    name: 'digest',
    description: 'Story summaries for a unit: the digest and its keyword index, the running history, and the wrap-up.',
    actions: {
        write: action({
            describe: 'Write digest.md (summary, decisions, tags) and update the cross-unit keyword index.',
            schema: z.object({
                id: z.string().describe('Unit id.'),
                summary: z.string().min(1).describe('One-paragraph story summary.'),
                decisions: z.array(z.string()).describe('Decisions taken, one per entry.'),
                tags: z.array(z.string()).optional().describe('Free-form tags.'),
            }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                const digest = { summary: input.summary, decisions: input.decisions, tags: input.tags ?? [] };
                fs.writeFileSync(path.join(unit.dir, 'digest.md'), renderDigest(unit.id, digest));
                const entry = entryFor(unit.id, unit.state.repo, digest, ctx.now().toISOString());
                upsertEntry(ctx.vault, entry);
                appendHistory(unit.dir, `digest written (${digest.decisions.length} decision(s))`, ctx.now);
                return result(`Digest written for ${unit.id}; index updated (${entry.tokens.length} tokens).`, envelope(true, 'digest written', { id: unit.id, digest, tokens: entry.tokens }));
            }),
        }),
        get: action({
            describe: 'Return the digest for a unit.',
            schema: z.object({ id: z.string().describe('Unit id.') }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                const digest = readDigest(unit.dir);
                const text = digest ? renderDigest(unit.id, digest).trimEnd() : `No digest written for ${unit.id}.`;
                return result(text, envelope(true, digest ? 'digest found' : 'no digest', { id: unit.id, digest }));
            }),
        }),
        history: action({
            describe: 'Append a line to the unit history when `line` is given; otherwise return the history.',
            schema: z.object({ id: z.string().describe('Unit id.'), line: z.string().optional().describe('Line to append.') }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                if (input.line !== undefined) {
                    appendHistory(unit.dir, input.line, ctx.now);
                    return result(`Appended to history: ${input.line}`, envelope(true, 'history appended', { id: unit.id, line: input.line }));
                }
                const lines = (readIf(path.join(unit.dir, 'history.md')) ?? '').trimEnd().split('\n').filter(Boolean);
                return result(lines.join('\n') || 'No history yet.', envelope(true, `${lines.length} history line(s)`, { id: unit.id, lines }));
            }),
        }),
        wrapup: action({
            describe: 'Render the wrap-up: PR link, stage table, scope ledger, not-built list, held drafts, and Not proven for reduced modes.',
            schema: z.object({ id: z.string().describe('Unit id.') }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                const mode = modeOf(unit, ctx);
                const draftsDir = path.join(unit.dir, 'drafts');
                const drafts = fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir).filter((f) => f.endsWith('.md')).sort() : [];
                const requirement = requirementOf(unit.dir);
                const wrapup = renderWrapup(unit.state, requirement, mode, { plan: readIf(path.join(unit.dir, 'plan.md')), drafts, now: ctx.now() });
                const stages = stageTable(unit.state, ctx.now());
                return result(wrapup, envelope(true, `wrap-up for ${unit.id}`, { id: unit.id, pr: unit.state.pr?.url ?? null, stages, drafts, mode: mode.name }));
            }),
        }),
    },
});
