import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { envelope } from '../contracts/envelope.js';
import { action, defineTool, fail, result } from '../registry/tools.js';
import { numberCriteria, parseRelated, parseRequirement, renderRelated, renderRequirement, } from '../spec/requirement.js';
import { appendHistory, writeState } from '../store/state.js';
import { loadUnit, readSource } from '../store/units.js';
export const BUG_WORDS = /\b(bug|defect|regression|broken|crash|error)\b/i;
export function inferKind(title, body) {
    return BUG_WORDS.test(`${title}\n${body}`) ? 'bug' : 'feature';
}
function requirementPath(dir) {
    return path.join(dir, 'requirement.md');
}
function readRequirement(dir) {
    const file = requirementPath(dir);
    return fs.existsSync(file) ? parseRequirement(fs.readFileSync(file, 'utf8')) : null;
}
function readRelated(dir) {
    const file = path.join(dir, 'related.md');
    return fs.existsSync(file) ? parseRelated(fs.readFileSync(file, 'utf8')) : [];
}
function withUnit(ctx, id, fn) {
    const unit = loadUnit(ctx, id);
    if (!unit)
        return fail(`unit "${id}" not found in the current namespace`);
    return fn(unit);
}
function criteriaText(req) {
    if (!req?.criteria.length)
        return 'No acceptance criteria recorded.';
    return req.criteria.map((c) => `- ${c.id}: ${c.text}`).join('\n');
}
export const specTool = defineTool({
    name: 'spec',
    description: 'Requirement context for a unit: record the normalized requirement, pin the source, number acceptance criteria, link related items.',
    actions: {
        record: action({
            describe: 'Write requirement.md (title, url, body) and set the unit kind, inferring bug from the wording when not given.',
            schema: z.object({
                id: z.string().describe('Unit id.'),
                title: z.string().describe('Requirement title.'),
                body: z.string().describe('Normalized requirement text.'),
                kind: z.enum(['feature', 'bug', 'chore', 'unknown']).optional().describe('Unit kind; inferred when omitted.'),
                url: z.string().optional().describe('Tracker url for the requirement.'),
            }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                const existing = readRequirement(unit.dir);
                const req = { title: input.title, url: input.url ?? existing?.url ?? null, body: input.body, criteria: existing?.criteria ?? [] };
                fs.writeFileSync(requirementPath(unit.dir), renderRequirement(req));
                const kind = input.kind ?? inferKind(input.title, input.body);
                writeState(unit.dir, { ...unit.state, kind }, ctx.now);
                appendHistory(unit.dir, `requirement recorded: ${input.title} (kind ${kind})`, ctx.now);
                return result(`Recorded requirement "${input.title}" for ${unit.id} as ${kind}.`, envelope(true, `requirement recorded (${kind})`, { id: unit.id, kind, title: input.title, url: req.url, criteria: req.criteria }));
            }),
        }),
        pin: action({
            describe: 'Pin the verbatim source text into source.md and mark the source pinned.',
            schema: z.object({
                id: z.string().describe('Unit id.'),
                text: z.string().describe('Verbatim source text.'),
                ref: z.string().optional().describe('Source reference (ticket key, url, path).'),
            }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                fs.writeFileSync(path.join(unit.dir, 'source.md'), input.text);
                const source = { ...unit.state.source, pinned: true, ref: input.ref ?? unit.state.source.ref };
                writeState(unit.dir, { ...unit.state, source }, ctx.now);
                appendHistory(unit.dir, `source pinned (${input.text.length} chars)`, ctx.now);
                return result(`Pinned ${input.text.length} chars of source for ${unit.id}.`, envelope(true, 'source pinned', { id: unit.id, source, chars: input.text.length }));
            }),
        }),
        criteria: action({
            describe: 'Set (renumbering as AC-1…) or read the acceptance criteria in requirement.md.',
            schema: z.object({
                id: z.string().describe('Unit id.'),
                set: z.array(z.string().min(1)).optional().describe('Replace the criteria with these texts, numbered in order.'),
            }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                let req = readRequirement(unit.dir) ?? { title: `Requirement for ${unit.id}`, url: null, body: '', criteria: [] };
                if (input.set) {
                    req = { ...req, criteria: numberCriteria(input.set) };
                    fs.writeFileSync(requirementPath(unit.dir), renderRequirement(req));
                    appendHistory(unit.dir, `acceptance criteria set (${req.criteria.length})`, ctx.now);
                }
                const summary = input.set ? `${req.criteria.length} criteria set` : `${req.criteria.length} criteria`;
                return result(criteriaText(req), envelope(true, summary, { id: unit.id, criteria: req.criteria }));
            }),
        }),
        related: action({
            describe: 'Record related items (parent, siblings, linked docs, prior PRs) in related.md.',
            schema: z.object({
                id: z.string().describe('Unit id.'),
                items: z.array(z.object({
                    kind: z.enum(['parent', 'sibling', 'linked', 'pr']),
                    ref: z.string().min(1),
                    title: z.string().optional(),
                    note: z.string().optional(),
                })).describe('Related items; replaces the current list.'),
            }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                const items = input.items.map((it) => ({ kind: it.kind, ref: it.ref, title: it.title ?? null, note: it.note ?? null }));
                fs.writeFileSync(path.join(unit.dir, 'related.md'), renderRelated(items));
                appendHistory(unit.dir, `related items recorded (${items.length})`, ctx.now);
                return result(renderRelated(items).trimEnd(), envelope(true, `${items.length} related item(s) recorded`, { id: unit.id, related: items }));
            }),
        }),
        get: action({
            describe: 'Return the requirement, criteria, pinned source and related items for a unit.',
            schema: z.object({ id: z.string().describe('Unit id.') }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                const requirement = readRequirement(unit.dir);
                const related = readRelated(unit.dir);
                const text = readSource(unit.dir);
                const data = { id: unit.id, kind: unit.state.kind, source: { ...unit.state.source, text }, requirement, related };
                const lines = [
                    requirement ? `# ${requirement.title}` : `# ${unit.id} (no requirement recorded)`,
                    requirement?.url ? `Source: ${requirement.url}` : '',
                    requirement?.body ?? '',
                    '',
                    '## Acceptance criteria',
                    criteriaText(requirement),
                    '',
                    related.length ? renderRelated(related).trimEnd() : '# Related\n\nnone recorded',
                    '',
                    text === null ? 'Pinned source: none' : `Pinned source: ${text.length} chars`,
                ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));
                return result(lines.join('\n'), envelope(true, `spec for ${unit.id}`, data));
            }),
        }),
    },
});
