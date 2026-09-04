import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { envelope } from '../contracts/envelope.js';
import '../gates/index.js';
import { resolveMode, UnknownModeError } from '../modes.js';
import { action, defineTool, fail, result, type ToolContext, type ToolResult } from '../registry/tools.js';
import { parseRequirement } from '../spec/requirement.js';
import { homeRelative } from '../store/paths.js';
import { appendHistory, writeState, type PrRecord, type Thread } from '../store/state.js';
import { loadUnit, type LoadedUnit } from '../store/units.js';
import { renderPrBody } from '../text/pr-body.js';

function withUnit(ctx: ToolContext, id: string, fn: (unit: LoadedUnit) => Promise<ToolResult> | ToolResult): Promise<ToolResult> | ToolResult {
  const unit = loadUnit(ctx, id);
  if (!unit) return fail(`unit "${id}" not found in the current namespace`);
  return fn(unit);
}

function readIf(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

const ThreadSchema = z.object({
  id: z.string(),
  author: z.string(),
  body: z.string(),
  path: z.string().optional(),
  line: z.number().int().optional(),
  resolved: z.boolean(),
});

export const pullreqTool = defineTool({
  name: 'pullreq',
  description: 'Pull request bookkeeping: ghostwritten body from the record, PR and thread records.',
  actions: {
    body: action({
      describe: 'Render the PR body from the unit record and save it as drafts/pr-body.md.',
      schema: z.object({ id: z.string().describe('Unit id.') }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, (unit) => {
          let mode;
          try {
            mode = resolveMode(unit.state.mode, ctx.config.config);
          } catch (e) {
            if (!(e instanceof UnknownModeError)) throw e;
            mode = resolveMode('thorough', ctx.config.config);
          }
          const reqText = readIf(path.join(unit.dir, 'requirement.md'));
          const requirement = reqText ? parseRequirement(reqText) : null;
          const body = renderPrBody(unit.state, requirement, mode, { plan: readIf(path.join(unit.dir, 'plan.md')) });
          const draftAbs = path.join(unit.dir, 'drafts', 'pr-body.md');
          fs.mkdirSync(path.dirname(draftAbs), { recursive: true });
          fs.writeFileSync(draftAbs, body);
          appendHistory(unit.dir, 'pr body drafted', ctx.now);
          return result(body, envelope(true, `pr body drafted (${body.length} chars)`, { id: unit.id, body, draft: homeRelative(draftAbs), mode: mode.name }));
        }),
    }),

    record: action({
      describe: 'Record the opened pull request on the unit and stop the running stage timer.',
      schema: z.object({
        id: z.string().describe('Unit id.'),
        url: z.string().min(1).describe('PR url.'),
        number: z.number().int().optional().describe('PR number if known.'),
        base: z.string().min(1).describe('Base branch.'),
        head: z.string().min(1).describe('Head branch.'),
      }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, (unit) => {
          const at = ctx.now().toISOString();
          const pr: PrRecord = { url: input.url, number: input.number ?? null, base: input.base, head: input.head, opened_at: at, threads: unit.state.pr?.threads ?? [] };
          const timers = unit.state.timers.map((t) => (t.ended_at === null ? { ...t, ended_at: at } : t));
          writeState(unit.dir, { ...unit.state, pr, timers }, ctx.now);
          appendHistory(unit.dir, `pull request recorded: ${input.url} (${input.head} -> ${input.base})`, ctx.now);
          return result(`Recorded PR ${input.url} (${input.head} → ${input.base}).`, envelope(true, 'pr recorded', { id: unit.id, pr }));
        }),
    }),

    threads: action({
      describe: 'Replace the recorded review threads on the PR.',
      schema: z.object({ id: z.string().describe('Unit id.'), threads: z.array(ThreadSchema).describe('Current threads; replaces the stored list.') }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, (unit) => {
          if (!unit.state.pr) return fail(`pullreq threads: ${unit.id} has no recorded PR; call pullreq record first`);
          const threads: Thread[] = input.threads;
          const open = threads.filter((t) => !t.resolved).length;
          writeState(unit.dir, { ...unit.state, pr: { ...unit.state.pr, threads } }, ctx.now);
          appendHistory(unit.dir, `pr threads updated: ${threads.length} total, ${open} open`, ctx.now);
          return result(`${threads.length} thread(s), ${open} open.`, envelope(true, `${threads.length} thread(s)`, { id: unit.id, total: threads.length, open, threads }));
        }),
    }),

    get: action({
      describe: 'Return the recorded PR with its threads.',
      schema: z.object({ id: z.string().describe('Unit id.') }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, (unit) => {
          const pr = unit.state.pr;
          const text = pr ? `${pr.url}${pr.number !== null ? ` (#${pr.number})` : ''}: ${pr.head} → ${pr.base}, ${pr.threads.length} thread(s), ${pr.threads.filter((t) => !t.resolved).length} open` : 'No PR recorded.';
          return result(text, envelope(true, pr ? 'pr found' : 'no pr', { id: unit.id, pr }));
        }),
    }),
  },
});
