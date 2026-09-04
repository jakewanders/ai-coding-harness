import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { envelope } from '../contracts/envelope.js';
import { EVIDENCE_KINDS, EVIDENCE_KIND_NAMES } from '../evidence/kinds.js';
import '../gates/index.js';
import { resolveMode, UnknownModeError } from '../modes.js';
import { resolveGates } from '../registry/gates.js';
import { isCoreStage, CORE_ORDER } from '../registry/stages.js';
import { action, defineTool, fail, result } from '../registry/tools.js';
import { appendHistory, writeState } from '../store/state.js';
import { loadUnit } from '../store/units.js';
import { requiredColumns } from '../review/columns.js';
import { latestPerColumn, synthesize } from '../review/synthesize.js';
function withUnit(ctx, id, fn) {
    const unit = loadUnit(ctx, id);
    if (!unit)
        return fail(`unit "${id}" not found in the current namespace`);
    return fn(unit);
}
export function modeFor(unit, ctx) {
    try {
        return resolveMode(unit.state.mode, ctx.config.config);
    }
    catch (e) {
        if (e instanceof UnknownModeError)
            return resolveMode('thorough', ctx.config.config);
        throw e;
    }
}
export async function gatesForUnit(unit, ctx, stage) {
    return resolveGates(stage, { state: unit.state, config: ctx.config.config, unitDir: unit.dir, worktree: unit.state.worktree, cwd: ctx.cwd, vault: ctx.vault }, modeFor(unit, ctx));
}
function gateLine(g) {
    return `- ${g.id} [${g.severity}] ${g.status}${g.remedy ? ` — ${g.remedy}` : ''}${g.demoted_by ? ` (demoted by ${g.demoted_by})` : ''}`;
}
export const evidenceTool = defineTool({
    name: 'evidence',
    description: 'Record and inspect quality evidence for a unit and see which gates it satisfies.',
    actions: {
        record: action({
            describe: 'Validate a payload against its evidence kind and append it for the current cycle.',
            schema: z.object({
                id: z.string().describe('Unit id.'),
                kind: z.enum(EVIDENCE_KIND_NAMES).describe('Evidence kind.'),
                payload: z.unknown().describe("The record; shape depends on kind (see the kind's remedy text)."),
            }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                const def = EVIDENCE_KINDS[input.kind];
                const parsed = def.schema.safeParse(input.payload);
                if (!parsed.success) {
                    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
                    return fail(`evidence ${input.kind} rejected (${issues}); ${def.remedy}`, { kind: input.kind, issues: parsed.error.issues, remedy: def.remedy });
                }
                const record = { kind: input.kind, cycle: unit.state.cycle, recorded_at: ctx.now().toISOString(), payload: parsed.data };
                writeState(unit.dir, { ...unit.state, evidence: [...unit.state.evidence, record] }, ctx.now);
                appendHistory(unit.dir, `evidence recorded: ${input.kind} (cycle ${unit.state.cycle})`, ctx.now);
                return result(`Recorded ${input.kind} for ${unit.id} (cycle ${unit.state.cycle}).`, envelope(true, `${input.kind} recorded`, { id: unit.id, kind: input.kind, cycle: unit.state.cycle, count: unit.state.evidence.length + 1 }));
            }),
        }),
        list: action({
            describe: 'List evidence records, optionally filtered by kind and cycle.',
            schema: z.object({
                id: z.string().describe('Unit id.'),
                kind: z.enum(EVIDENCE_KIND_NAMES).optional(),
                cycle: z.number().int().nonnegative().optional(),
            }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                const records = unit.state.evidence.filter((e) => (input.kind ? e.kind === input.kind : true) && (input.cycle !== undefined ? e.cycle === input.cycle : true));
                const text = records.length ? records.map((e) => `- ${e.kind} (cycle ${e.cycle}, ${e.recorded_at})`).join('\n') : 'No matching evidence.';
                return result(text, envelope(true, `${records.length} record(s)`, { id: unit.id, records }));
            }),
        }),
        gates: action({
            describe: "Resolve the gates for the unit's current stage (or a named stage) with live pass/fail status.",
            schema: z.object({ id: z.string().describe('Unit id.'), stage: z.string().optional().describe('Core stage; defaults to the current stage.') }),
            handler: async (input, ctx) => withUnit(ctx, input.id, async (unit) => {
                const stage = input.stage ?? unit.state.stage;
                if (!isCoreStage(stage))
                    return fail(`evidence gates: unknown stage "${stage}"; core stages: ${CORE_ORDER.join(', ')}`);
                const gates = await gatesForUnit(unit, ctx, stage);
                const failing = gates.filter((g) => g.status === 'fail' && g.severity === 'block').length;
                const text = [`Gates for ${stage} (${unit.id}, cycle ${unit.state.cycle}):`, ...(gates.length ? gates.map(gateLine) : ['- none'])].join('\n');
                return result(text, envelope(true, `${gates.length} gate(s), ${failing} blocking failure(s)`, { id: unit.id, stage, gates }));
            }),
        }),
        check: action({
            describe: 'Resolve one gate by id for the unit and report its status and remedy.',
            schema: z.object({ id: z.string().describe('Unit id.'), gate: z.string().describe('Gate id.') }),
            handler: async (input, ctx) => withUnit(ctx, input.id, async (unit) => {
                for (const stage of CORE_ORDER) {
                    const gates = await gatesForUnit(unit, ctx, stage);
                    const g = gates.find((x) => x.id === input.gate);
                    if (g)
                        return result(gateLine(g), envelope(g.status !== 'fail', `${g.id}: ${g.status}`, { ...g, stage }));
                }
                return fail(`evidence check: no gate "${input.gate}" applies to ${unit.id}`);
            }),
        }),
        synthesize: action({
            describe: "Merge this cycle's review columns into one verdict (ship, needs_attention, not_ready); writes reviews/cycle-<n>.json and state.reviews.",
            schema: z.object({ id: z.string().describe('Unit id.') }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                const mode = modeFor(unit, ctx);
                const records = unit.state.evidence
                    .filter((e) => e.kind === 'review_column' && e.cycle === unit.state.cycle)
                    .map((e) => e.payload);
                const columns = latestPerColumn(records);
                const required = requiredColumns({ config: ctx.config.config, repo: unit.state.repo, mode });
                const synthesis = synthesize(columns, required);
                const review = { cycle: unit.state.cycle, ...synthesis, columns: columns.map((c) => ({ column: c.column, findings: c.findings.length })), at: ctx.now().toISOString() };
                fs.mkdirSync(path.join(unit.dir, 'reviews'), { recursive: true });
                fs.writeFileSync(path.join(unit.dir, 'reviews', `cycle-${unit.state.cycle}.json`), JSON.stringify(review, null, 2) + '\n');
                writeState(unit.dir, { ...unit.state, reviews: { ...(unit.state.reviews ?? {}), [unit.state.cycle]: synthesis.verdict } }, ctx.now);
                appendHistory(unit.dir, `review synthesized for cycle ${unit.state.cycle}: ${synthesis.verdict}`, ctx.now);
                const counts = Object.entries(synthesis.counts).map(([k, v]) => `${k} ${v}`).join(', ');
                const lines = [`Cycle ${unit.state.cycle}: ${synthesis.verdict} (${counts}).`];
                if (synthesis.missing_columns.length)
                    lines.push(`Missing required columns: ${synthesis.missing_columns.join(', ')}.`);
                return result(lines.join('\n'), envelope(synthesis.verdict === 'ship', `verdict ${synthesis.verdict}`, { id: unit.id, cycle: unit.state.cycle, ...synthesis, required }));
            }),
        }),
    },
});
