import { z } from 'zod';
import { envelope } from '../contracts/envelope.js';
import { hasSeat } from '../registry/gates.js';
import { action, defineTool, fail, result, type ToolContext, type ToolResult } from '../registry/tools.js';
import { appendHistory, writeState, type Thread, type UnitState } from '../store/state.js';
import { loadUnit, type LoadedUnit } from '../store/units.js';
import { seatWiring } from '../brief/seats.js';

export const MAX_POLLS = 10;
export const POLL_INTERVAL_S = 30;
export const MAX_ROUNDS = 2;

type Bot = NonNullable<UnitState['bot']>;

function withBotUnit(ctx: ToolContext, id: string, fn: (unit: LoadedUnit) => ToolResult): ToolResult {
  const unit = loadUnit(ctx, id);
  if (!unit) return fail(`unit "${id}" not found in the current namespace`);
  if (!hasSeat(ctx.config.config, 'reviewbot')) return fail('reviewbot: the reviewbot seat is unwired; skip the review-bot loop and say so');
  if (!unit.state.pr) return fail(`reviewbot: ${unit.id} has no recorded pull request; call pullreq record first`);
  return fn(unit);
}

function botOf(unit: LoadedUnit): Bot {
  return unit.state.bot ?? { round: 0, status: 'pending', threads: [] };
}

const ThreadSchema = z.object({ id: z.string(), author: z.string(), body: z.string(), path: z.string().optional(), line: z.number().int().optional(), resolved: z.boolean() });

export const reviewbotTool = defineTool({
  name: 'reviewbot',
  description: 'Bookkeeping for the post-publish review-bot loop: mark ready, poll status within a budget, store bot threads, count rounds (max two).',
  actions: {
    ready: action({
      describe: 'Start the loop: records bot state (round 0, pending) and suggests the codehost call that marks the PR ready for review.',
      schema: z.object({ id: z.string().describe('Unit id.') }),
      handler: async (input, ctx) =>
        withBotUnit(ctx, input.id, (unit) => {
          const bot: Bot = { round: 0, status: 'pending', threads: unit.state.bot?.threads ?? [] };
          writeState(unit.dir, { ...unit.state, bot }, ctx.now);
          appendHistory(unit.dir, 'review-bot loop started', ctx.now);
          const wiring = seatWiring(ctx.config.config);
          const codehost = wiring.codehost === 'unwired' ? null : wiring.codehost;
          const lines = [
            `Mark ${unit.state.pr!.url} ready for review${codehost ? ` with the codehost seat (${codehost.join(', ')})` : ' by hand (codehost seat unwired)'}, then poll the bot status with reviewbot poll.`,
            `Poll at most ${MAX_POLLS} polls, ${POLL_INTERVAL_S} s apart, using the reviewbot seat (${(wiring.reviewbot as string[]).join(', ')}).`,
          ];
          return result(lines.join('\n'), envelope(true, 'review-bot loop started', { id: unit.id, bot, codehost, max_polls: MAX_POLLS, poll_interval_s: POLL_INTERVAL_S }, [{ tool: 'reviewbot', action: 'poll', why: 'record the bot status after each poll' }]));
        }),
    }),

    poll: action({
      describe: 'Record the bot status after a poll; says whether to keep polling (budget of 10 polls, 30 s apart).',
      schema: z.object({
        id: z.string().describe('Unit id.'),
        status: z.enum(['pending', 'passed', 'changes_requested', 'failed']),
        polls: z.number().int().nonnegative().optional().describe('Polls made so far, including this one.'),
      }),
      handler: async (input, ctx) =>
        withBotUnit(ctx, input.id, (unit) => {
          const bot: Bot = { ...botOf(unit), status: input.status };
          writeState(unit.dir, { ...unit.state, bot }, ctx.now);
          appendHistory(unit.dir, `review-bot poll: ${input.status}${input.polls !== undefined ? ` (poll ${input.polls})` : ''}`, ctx.now);
          const polls = input.polls ?? 0;
          const keep = input.status === 'pending' && polls < MAX_POLLS;
          const text = input.status === 'pending'
            ? keep ? `Bot still pending after ${polls} poll(s); poll again in ${POLL_INTERVAL_S} s (budget ${MAX_POLLS}).` : `Bot still pending after ${polls} polls; stop polling and defer to the human.`
            : `Bot status: ${input.status}. ${input.status === 'changes_requested' ? 'Pull its threads with reviewbot threads, then route.' : 'Route to continue.'}`;
          return result(text, envelope(true, `bot ${input.status}`, { id: unit.id, status: input.status, polls, keep_polling: keep }, keep ? [] : [{ tool: 'unit', action: 'route', why: 'decide the next step from the bot status' }]));
        }),
    }),

    threads: action({
      describe: 'Store the bot review threads separately from human PR threads.',
      schema: z.object({ id: z.string().describe('Unit id.'), threads: z.array(ThreadSchema) }),
      handler: async (input, ctx) =>
        withBotUnit(ctx, input.id, (unit) => {
          const threads: Thread[] = input.threads;
          const bot: Bot = { ...botOf(unit), threads };
          writeState(unit.dir, { ...unit.state, bot }, ctx.now);
          appendHistory(unit.dir, `review-bot threads stored: ${threads.length}`, ctx.now);
          return result(`${threads.length} bot thread(s) stored (${threads.filter((t) => !t.resolved).length} open).`, envelope(true, `${threads.length} bot thread(s)`, { id: unit.id, threads }));
        }),
    }),

    round: action({
      describe: 'Count a fix-or-reply round; after two rounds the decision is defer_to_human.',
      schema: z.object({ id: z.string().describe('Unit id.') }),
      handler: async (input, ctx) =>
        withBotUnit(ctx, input.id, (unit) => {
          const bot: Bot = { ...botOf(unit), round: botOf(unit).round + 1 };
          writeState(unit.dir, { ...unit.state, bot }, ctx.now);
          const decision = bot.round > MAX_ROUNDS ? 'defer_to_human' : 'respond';
          appendHistory(unit.dir, `review-bot round ${bot.round}: ${decision}`, ctx.now);
          const text = decision === 'respond' ? `Round ${bot.round} of ${MAX_ROUNDS}: dispatch respond for the bot threads (one batched commit).` : `Round ${bot.round} exceeds the cap of ${MAX_ROUNDS}; defer the remaining bot findings to a human.`;
          return result(text, envelope(decision === 'respond', decision, { id: unit.id, round: bot.round, decision }));
        }),
    }),
  },
});
