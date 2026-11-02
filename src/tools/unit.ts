import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildHeader, renderBrief } from '../brief/render.js';
import '../flows/index.js';
import '../gates/index.js';
import { envelope, type NextAction } from '../contracts/envelope.js';
import { defaultBranch } from '../git/exec.js';
import { BUILT_IN_MODES, resolveMode, UnknownModeError, type ModeDef } from '../modes.js';
import { routeNext } from '../pilot/route.js';
import { hasCapability, resolveGates, transitionAllowed, type ResolvedGate } from '../registry/gates.js';
import { CORE_ORDER, isCoreStage, nextStageFor, stageEntry, type BriefContext } from '../registry/stages.js';
import { action, defineTool, fail, result, type ToolContext, type ToolResult } from '../registry/tools.js';
import { CORE_STAGE_MODULES } from '../stages/index.js';
import { selectDocs } from '../kits/select.js';
import { syntheticId } from '../store/ids.js';
import { appendHistory, createState, writeState, type Report, type SourceKind, type StageName, type UnitState } from '../store/state.js';
import { applyTransition } from '../store/transition.js';
import { listUnitIds, loadUnit, namespaceFor, resolveUnit, type LoadedUnit } from '../store/units.js';
import { ensureUnitDir, ensureVault } from '../store/vault.js';

const SOURCE_KINDS = ['ticket', 'pr', 'url', 'file', 'conversation', 'text'] as const;

function statusLine(s: UnitState): string {
  return `${s.id} · ${s.stage} · cycle ${s.cycle} · ${s.mode} · ${s.branch ?? 'no branch'}`;
}

function briefNext(id: string, why: string): NextAction[] {
  return [{ tool: 'unit', action: 'brief', why: `${why}; request the brief for ${id}` }];
}

function modeOf(state: UnitState, ctx: ToolContext): ModeDef {
  try {
    return resolveMode(state.mode, ctx.config.config);
  } catch (e) {
    if (e instanceof UnknownModeError) return resolveMode('thorough', ctx.config.config);
    throw e;
  }
}

async function gatesFor(stage: StageName, unit: LoadedUnit, ctx: ToolContext, mode: ModeDef): Promise<ResolvedGate[]> {
  return resolveGates(stage, { state: unit.state, config: ctx.config.config, unitDir: unit.dir, worktree: unit.state.worktree, cwd: ctx.cwd, vault: ctx.vault }, mode);
}

function routing(state: UnitState, ctx: ToolContext, mode: ModeDef) {
  return { skip: mode.skip_stages, browserUi: hasCapability(ctx.config.config, state.repo, 'browser_ui') };
}

function notFound(id: string, ctx: ToolContext): ToolResult {
  const known = listUnitIds(ctx.vault, namespaceFor(ctx.cwd));
  return fail(`unit "${id}" not found in ${namespaceFor(ctx.cwd)}${known.length ? `; known: ${known.join(', ')}` : ''}`);
}

function pinnedText(source: SourceKind, text: string | undefined, ref: string | undefined): string | null {
  if (text !== undefined) return text;
  if (source === 'file' && ref) return fs.readFileSync(ref, 'utf8');
  return null;
}

export const unitTool = defineTool({
  name: 'unit',
  description: 'Unit of work bookkeeping: start, status, list, brief, advance, report and route through the core stages.',
  actions: {
    start: action({
      describe: 'Create a unit from a source (ticket, pr, url, file, conversation, text) and pin its text.',
      schema: z.object({
        source: z.enum(SOURCE_KINDS).describe('Where the unit comes from.'),
        ref: z.string().optional().describe('Ticket key, PR reference, url, or file path.'),
        id: z.string().optional().describe('Unit id; defaults to the ticket key or a synthetic local id.'),
        mode: z.string().optional().describe('Run mode name; defaults to thorough.'),
        text: z.string().optional().describe('Verbatim source text to pin.'),
      }),
      handler: async (input, ctx) => {
        const ns = namespaceFor(ctx.cwd);
        if (input.source === 'ticket' && !input.ref && !input.id) return fail('unit start: ticket sources need a ref (the ticket key)');
        if (input.source === 'file' && !input.ref && input.text === undefined) return fail('unit start: file sources need a ref (the path) or text');
        const prNumber = input.source === 'pr' && input.ref ? /(\d+)\s*$/.exec(input.ref.trim())?.[1] : undefined;
        const id = input.id ?? (input.source === 'ticket' ? input.ref! : prNumber ? `pr-${prNumber}` : syntheticId(input.text ?? input.ref ?? ''));
        const modeName = input.mode ?? 'thorough';
        try {
          resolveMode(modeName, ctx.config.config);
        } catch (e) {
          const known = [...Object.keys(BUILT_IN_MODES), ...Object.keys(ctx.config.config.modes ?? {}).filter((m) => !(m in BUILT_IN_MODES))];
          return fail(`unit start: ${e instanceof Error ? e.message : String(e)}; known modes: ${known.join(', ')}`);
        }
        if (loadUnit(ctx, id)) return fail(`unit "${id}" already exists; use unit status or unit brief`);

        let pinned: string | null;
        try {
          pinned = pinnedText(input.source, input.text, input.ref);
        } catch (e) {
          return fail(`unit start: cannot read source file: ${e instanceof Error ? e.message : String(e)}`);
        }

        ensureVault(ctx.vault);
        const dir = ensureUnitDir(ctx.vault, ns, id);
        const base = ctx.config.config.repos?.[ns]?.base_branch ?? defaultBranch(ctx.cwd);
        const state = createState(
          { id, repo: ns, tracked: Boolean(input.id) || input.source === 'ticket', source: { kind: input.source, ref: input.ref ?? null, pinned: pinned !== null }, mode: modeName, base_branch: base },
          ctx.now,
        );
        state.timers.push({ stage: 'define', started_at: ctx.now().toISOString(), ended_at: null, idle_gaps_ms: 0 });
        if (pinned !== null) fs.writeFileSync(path.join(dir, 'source.md'), pinned);
        writeState(dir, state, ctx.now);
        appendHistory(dir, `unit started from ${input.source}${input.ref ? ` ${input.ref}` : ''} in mode ${modeName}`, ctx.now);

        const data = { id, repo: ns, tracked: state.tracked, stage: state.stage, mode: modeName, pinned: pinned !== null, dir };
        return result(`Started ${statusLine(state)}.`, envelope(true, `unit ${id} started`, data, briefNext(id, 'unit created at define')));
      },
    }),

    status: action({
      describe: 'One-line status of a unit.',
      schema: z.object({ id: z.string().optional().describe('Unit id; defaults to the unit implied by the current branch.') }),
      handler: async (input, ctx) => {
        const unit = resolveUnit(ctx, input.id);
        if (!unit) return input.id ? notFound(input.id, ctx) : fail('unit status: no id given and none implied by the current branch');
        const s = unit.state;
        return result(statusLine(s), envelope(true, statusLine(s), { id: s.id, stage: s.stage, cycle: s.cycle, mode: s.mode, branch: s.branch, worktree: s.worktree, tracked: s.tracked }));
      },
    }),

    list: action({
      describe: 'List every unit in the current repo namespace.',
      schema: z.object({}),
      handler: async (_input, ctx) => {
        const ns = namespaceFor(ctx.cwd);
        const units = listUnitIds(ctx.vault, ns)
          .map((id) => loadUnit(ctx, id))
          .filter((u): u is LoadedUnit => u !== null)
          .map((u) => ({ id: u.id, stage: u.state.stage, cycle: u.state.cycle, mode: u.state.mode, branch: u.state.branch }));
        const text = units.length ? units.map((u) => `${u.id} · ${u.stage} · cycle ${u.cycle} · ${u.mode} · ${u.branch ?? 'no branch'}`).join('\n') : `No units in ${ns}.`;
        return result(text, envelope(true, `${units.length} unit(s) in ${ns}`, { namespace: ns, units }));
      },
    }),

    brief: action({
      describe: 'Render the brief for a stage: header, roles, config problems, source, then stage material.',
      schema: z.object({
        id: z.string().optional().describe('Unit id; defaults to the unit implied by the current branch.'),
        stage: z.string().optional().describe("Stage or flow name; defaults to the unit's current stage."),
        quiet: z.boolean().optional().describe('Suppress the single-stage stop banner (pilot dispatches).'),
      }),
      handler: async (input, ctx) => {
        const unit = resolveUnit(ctx, input.id);
        if (input.id && !unit) return notFound(input.id, ctx);
        const stageName = input.stage ?? unit?.state.stage;
        if (!stageName) return fail('unit brief: no stage given and no unit to take it from');
        const entry = stageEntry(stageName);
        if (!entry) return fail(`unit brief: unknown stage "${stageName}"; stages: ${CORE_ORDER.join(', ')} and the standalone flows`);
        if (!entry.standalone && !unit) return fail(`unit brief: stage ${stageName} needs a unit; pass id or check out its branch`);

        const ns = namespaceFor(ctx.cwd);
        let gates: ResolvedGate[] = [];
        if (unit && isCoreStage(stageName)) gates = await gatesFor(stageName, unit, ctx, modeOf(unit.state, ctx));
        const repoProfile = ctx.config.config.repos?.[unit?.state.repo ?? ns];
        const docs = selectDocs(ctx.config.kits ?? [], { tags: repoProfile?.tags ?? [], capabilities: (repoProfile?.capabilities ?? {}) as Record<string, unknown> });
        const header = buildHeader({ state: unit?.state ?? null, stage: stageName, config: ctx.config, namespace: ns, root: ctx.root, gates, docs, baseBranch: defaultBranch(ctx.cwd) });
        const briefCtx: BriefContext = { state: unit?.state ?? null, config: ctx.config, header, vault: ctx.vault, root: ctx.root, quiet: input.quiet ?? false, unitDir: unit?.dir ?? null, cwd: ctx.cwd };
        const text = renderBrief(briefCtx);
        return result(text, envelope(true, `brief for ${stageName}${unit ? ` (${unit.id})` : ''}`, { unit: unit?.id ?? null, stage: stageName, gates: header.gates, config_errors: header.config_errors.length }));
      },
    }),

    advance: action({
      describe: 'Move a unit to its next stage when the current stage gates allow it; otherwise list the remedies.',
      schema: z.object({
        id: z.string().describe('Unit id.'),
        to: z.string().optional().describe('Explicit target core stage; defaults to the routed next stage.'),
      }),
      handler: async (input, ctx) => {
        const unit = loadUnit(ctx, input.id);
        if (!unit) return notFound(input.id, ctx);
        const { state } = unit;
        const mode = modeOf(state, ctx);
        if (input.to !== undefined && !isCoreStage(input.to)) return fail(`unit advance: unknown target stage "${input.to}"; core stages: ${CORE_ORDER.join(', ')}`);
        if (state.stage === 'wrap_up') return fail(`unit ${state.id} is already closed`);

        const to = (input.to as StageName | undefined) ?? nextStageFor(state.stage, routing(state, ctx, mode));
        if (!to) return fail(`unit ${state.id}: no stage after ${state.stage}`);
        // Going back to build from review is a retry, not a promotion: no gates.
        const correction = to === 'build' && state.stage === 'review';
        const gates = correction ? [] : await gatesFor(state.stage, unit, ctx, mode);
        const verdict = transitionAllowed(gates);
        if (!verdict.ok) {
          const lines = [`Cannot leave ${state.stage}: ${verdict.blocking.length} blocking gate(s).`, ...verdict.blocking.map((g) => `- ${g.id}: ${g.remedy ?? 'no remedy given'}`)];
          return result(lines.join('\n'), envelope(false, `advance blocked at ${state.stage}`, { id: state.id, stage: state.stage, blocking: verdict.blocking, warnings: verdict.warnings }));
        }
        const at = ctx.now().toISOString();
        const { state: next, from, cycleIncremented: afterRevise } = applyTransition(state, to, at);
        writeState(unit.dir, next, ctx.now);
        appendHistory(unit.dir, `advance: ${from} -> ${to}${afterRevise ? ` (cycle ${next.cycle})` : ''}`, ctx.now);
        const warn = verdict.warnings.length ? ` Warnings: ${verdict.warnings.map((g) => g.id).join(', ')}.` : '';
        return result(
          `${state.id}: ${from} -> ${to}.${warn}`,
          envelope(true, `advanced ${from} -> ${to}`, { id: state.id, from, to, cycle: next.cycle, warnings: verdict.warnings }, briefNext(state.id, `now at ${to}`)),
        );
      },
    }),

    report: action({
      describe: 'Store a stage report (outcome, summary, questions, verdict, artifacts) for the current cycle.',
      schema: z.object({
        id: z.string().describe('Unit id.'),
        stage: z.string().describe('Stage the report is for; must be the current stage.'),
        outcome: z.enum(['done', 'blocked', 'failed']),
        summary: z.string().min(1),
        questions: z.array(z.string()).optional(),
        verdict: z.enum(['ship', 'needs_attention', 'not_ready']).optional(),
        artifacts: z.record(z.string(), z.string()).optional(),
      }),
      handler: async (input, ctx) => {
        const unit = loadUnit(ctx, input.id);
        if (!unit) return notFound(input.id, ctx);
        if (input.stage !== unit.state.stage) return fail(`unit report: ${unit.id} is at ${unit.state.stage}, not ${input.stage}`);
        const report: Report = { stage: input.stage, cycle: unit.state.cycle, outcome: input.outcome, summary: input.summary, questions: input.questions ?? [], artifacts: input.artifacts ?? {}, at: ctx.now().toISOString(), ...(input.verdict ? { verdict: input.verdict } : {}) };
        const reports = { ...(unit.state.reports ?? {}) };
        reports[input.stage] = [...(reports[input.stage] ?? []), report];
        const reviews = input.verdict && input.stage === 'review' ? { ...(unit.state.reviews ?? {}), [unit.state.cycle]: input.verdict } : unit.state.reviews;
        writeState(unit.dir, { ...unit.state, reports, ...(reviews ? { reviews } : {}) }, ctx.now);
        appendHistory(unit.dir, `report ${input.stage}: ${input.outcome}${input.verdict ? ` (${input.verdict})` : ''} — ${input.summary}`, ctx.now);
        return result(`Report stored for ${input.stage} (${input.outcome}${input.verdict ? `, ${input.verdict}` : ''}).`, envelope(true, `report ${input.outcome}`, { id: unit.id, report }, [{ tool: 'unit', action: 'route', why: 'ask the engine what to do next' }]));
      },
    }),

    route: action({
      describe: 'Decide the next stage from the reports (proceed, retry, blocked, done); applies the move when gates allow it.',
      schema: z.object({ id: z.string().describe('Unit id.') }),
      handler: async (input, ctx) => {
        const unit = loadUnit(ctx, input.id);
        if (!unit) return notFound(input.id, ctx);
        const mode = modeOf(unit.state, ctx);
        const browserUi = hasCapability(ctx.config.config, unit.state.repo, 'browser_ui');
        const route = routeNext(unit.state, mode, browserUi);
        const from = unit.state.stage;
        const base = { id: unit.id, from, ...route };
        if (route.decision === 'blocked') {
          return result([`Blocked at ${from}.`, ...route.questions.map((q) => `- ${q}`)].join('\n'), envelope(false, `blocked at ${from}`, base));
        }
        if (route.decision === 'done') return result(`${unit.id} is done.`, envelope(true, 'done', base, [{ tool: 'digest', action: 'wrapup', why: 'render the wrap-up for the user' }]));
        const next = route.next!;
        if (next !== from) {
          if (route.decision === 'proceed') {
            const gates = await gatesFor(from, unit, ctx, mode);
            const verdict = transitionAllowed(gates);
            if (!verdict.ok) {
              const questions = verdict.blocking.map((g) => `${g.id}: ${g.remedy ?? 'gate failing'}`);
              return result([`Cannot leave ${from}: gates failing.`, ...questions.map((q) => `- ${q}`)].join('\n'), envelope(false, `blocked at ${from} by gates`, { ...base, next: from, decision: 'blocked', questions, blocking: verdict.blocking }));
            }
          }
          const at = ctx.now().toISOString();
          const { state: moved, cycleIncremented } = applyTransition(unit.state, next, at);
          writeState(unit.dir, moved, ctx.now);
          appendHistory(unit.dir, `route: ${from} -> ${next} (${route.decision})${cycleIncremented ? ` cycle ${moved.cycle}` : ''}`, ctx.now);
        }
        const why = route.decision === 'retry' ? `retry at ${next}; request its brief with quiet: true and dispatch` : `dispatch ${next}; request its brief with quiet: true`;
        return result(`${route.decision}: ${next}${route.verdict ? ` (verdict ${route.verdict})` : ''}.`, envelope(true, `${route.decision} -> ${next}`, base, briefNext(unit.id, why)));
      },
    }),

    answer: action({
      describe: "Store the user's answers to blocked questions.",
      schema: z.object({ id: z.string().describe('Unit id.'), answers: z.record(z.string(), z.string()).describe('question -> answer') }),
      handler: async (input, ctx) => {
        const unit = loadUnit(ctx, input.id);
        if (!unit) return notFound(input.id, ctx);
        const answers = { ...unit.state.answers, ...input.answers };
        writeState(unit.dir, { ...unit.state, answers }, ctx.now);
        for (const [q, a] of Object.entries(input.answers)) appendHistory(unit.dir, `answer: ${q} -> ${a}`, ctx.now);
        return result(`Stored ${Object.keys(input.answers).length} answer(s).`, envelope(true, 'answers stored', { id: unit.id, answers }, [{ tool: 'unit', action: 'route', why: 'route again with the answers in state' }]));
      },
    }),

    link: action({
      describe: 'Record convoy siblings symmetrically on every unit in the group.',
      schema: z.object({ id: z.string().describe('Unit id.'), related: z.array(z.string().min(1)).min(1).describe('Sibling unit ids in the same convoy group.') }),
      handler: async (input, ctx) => {
        const ids = [...new Set([input.id, ...input.related])];
        const units = ids.map((id) => ({ id, unit: loadUnit(ctx, id) }));
        const missing = units.filter((u) => !u.unit).map((u) => u.id);
        if (missing.length) return fail(`unit link: unknown unit(s): ${missing.join(', ')}`);
        for (const { id, unit } of units) {
          const siblings = [...new Set([...(unit!.state.siblings ?? []), ...ids.filter((x) => x !== id)])].sort();
          writeState(unit!.dir, { ...unit!.state, siblings }, ctx.now);
          appendHistory(unit!.dir, `convoy siblings: ${siblings.join(', ')}`, ctx.now);
        }
        return result(`Linked ${ids.join(', ')} as convoy siblings.`, envelope(true, `${ids.length} units linked`, { ids }));
      },
    }),
  },
});
