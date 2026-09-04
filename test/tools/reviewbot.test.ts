import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import type { HarnessConfig } from '../../src/config/schema.js';
import { resolveMode } from '../../src/modes.js';
import { routeNext } from '../../src/pilot/route.js';
import { dispatch } from '../../src/registry/tools.js';
import { createState, readState, writeState, type Report, type UnitState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { pullreqTool } from '../../src/tools/pullreq.js';
import { reviewbotTool } from '../../src/tools/reviewbot.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

const BOT_CONFIG = 'schema: 1\nseats:\n  reviewbot:\n    status: [mcp__bot__status]\n    threads: [mcp__bot__threads]\n  codehost:\n    open_pr: [mcp__host__ready]\n';

async function unitCtx(config?: string, id = 'RB-1') {
  const files: Record<string, string> = { 'README.md': 'x' };
  if (config) files['.harness.yaml'] = config;
  const ctx = makeCtx({ cwd: makeRepo(files) });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id }, ctx);
  await dispatch(pullreqTool, { action: 'record', id, url: 'https://example.test/o/n/pull/3', number: 3, base: 'main', head: id }, ctx);
  return ctx;
}

describe('reviewbot tool', () => {
  it('ready records bot state and suggests the codehost call; poll records status and enforces the poll budget', async () => {
    const ctx = await unitCtx(BOT_CONFIG);
    const ready = await dispatch(reviewbotTool, { action: 'ready', id: 'RB-1' }, ctx);
    expect(ready.envelope.ok).toBe(true);
    expect(ready.text).toContain('mcp__host__ready');
    expect(ready.text).toMatch(/at most 10 polls/i);
    expect(readState(unitDirFor(ctx, 'RB-1')).bot).toEqual({ round: 0, status: 'pending', threads: [] });
    const poll = await dispatch(reviewbotTool, { action: 'poll', id: 'RB-1', status: 'pending', polls: 3 }, ctx);
    expect(poll.envelope.ok).toBe(true);
    expect(poll.envelope.data).toMatchObject({ status: 'pending', polls: 3, keep_polling: true });
    const exhausted = await dispatch(reviewbotTool, { action: 'poll', id: 'RB-1', status: 'pending', polls: 10 }, ctx);
    expect(exhausted.envelope.data).toMatchObject({ keep_polling: false });
    expect(exhausted.text).toMatch(/defer to (the )?human|stop polling/i);
    const changes = await dispatch(reviewbotTool, { action: 'poll', id: 'RB-1', status: 'changes_requested' }, ctx);
    expect(changes.envelope.data).toMatchObject({ status: 'changes_requested', keep_polling: false });
    expect(readState(unitDirFor(ctx, 'RB-1')).bot!.status).toBe('changes_requested');
  });

  it('threads stores bot threads apart from human PR threads', async () => {
    const ctx = await unitCtx(BOT_CONFIG);
    await dispatch(pullreqTool, { action: 'threads', id: 'RB-1', threads: [{ id: 'h1', author: 'human', body: 'nit', resolved: false }] }, ctx);
    await dispatch(reviewbotTool, { action: 'ready', id: 'RB-1' }, ctx);
    const r = await dispatch(reviewbotTool, { action: 'threads', id: 'RB-1', threads: [{ id: 'b1', author: 'bot', body: 'Possible null deref', path: 'src/a.ts', line: 4, resolved: false }] }, ctx);
    expect(r.envelope.ok).toBe(true);
    const state = readState(unitDirFor(ctx, 'RB-1'));
    expect(state.bot!.threads.map((t) => t.id)).toEqual(['b1']);
    expect(state.pr!.threads.map((t) => t.id)).toEqual(['h1']);
  });

  it('round increments and caps at two before deferring to a human', async () => {
    const ctx = await unitCtx(BOT_CONFIG);
    await dispatch(reviewbotTool, { action: 'ready', id: 'RB-1' }, ctx);
    const r1 = await dispatch(reviewbotTool, { action: 'round', id: 'RB-1' }, ctx);
    expect(r1.envelope.data).toMatchObject({ round: 1, decision: 'respond' });
    const r2 = await dispatch(reviewbotTool, { action: 'round', id: 'RB-1' }, ctx);
    expect(r2.envelope.data).toMatchObject({ round: 2, decision: 'respond' });
    const r3 = await dispatch(reviewbotTool, { action: 'round', id: 'RB-1' }, ctx);
    expect(r3.envelope.ok).toBe(false);
    expect(r3.envelope.data).toMatchObject({ round: 3, decision: 'defer_to_human' });
    expect(readState(unitDirFor(ctx, 'RB-1')).bot!.round).toBe(3);
  });

  it('requires a recorded PR and the reviewbot seat', async () => {
    const noSeat = await unitCtx();
    const r = await dispatch(reviewbotTool, { action: 'ready', id: 'RB-1' }, noSeat);
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.summary).toMatch(/unwired/);
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x', '.harness.yaml': BOT_CONFIG }) });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'RB-2' }, ctx);
    const noPr = await dispatch(reviewbotTool, { action: 'ready', id: 'RB-2' }, ctx);
    expect(noPr.envelope.ok).toBe(false);
    expect(noPr.envelope.summary).toMatch(/pullreq record/);
  });
});

describe('route after publish with a review bot', () => {
  const thorough = resolveMode('thorough', DEFAULTS);
  function published(bot?: UnitState['bot']): UnitState {
    const s = createState({ id: 'RB-9', repo: 'local/x', tracked: true, source: { kind: 'ticket', ref: 'RB-9', pinned: true }, mode: 'thorough', base_branch: 'main' });
    const report: Report = { stage: 'publish', cycle: 0, outcome: 'done', summary: 'pr opened', questions: [], artifacts: {}, at: '2026-09-04T00:00:00.000Z' };
    return { ...s, stage: 'publish', reports: { publish: [report] }, ...(bot ? { bot } : {}) };
  }

  it('goes to respond while the bot requests changes within two rounds, else to close', () => {
    expect(routeNext(published({ round: 0, status: 'changes_requested', threads: [] }), thorough, false, true)).toMatchObject({ next: 'respond', decision: 'proceed' });
    expect(routeNext(published({ round: 2, status: 'changes_requested', threads: [] }), thorough, false, true)).toMatchObject({ next: 'respond', decision: 'proceed' });
    expect(routeNext(published({ round: 3, status: 'changes_requested', threads: [] }), thorough, false, true)).toMatchObject({ next: 'close', decision: 'proceed' });
    expect(routeNext(published({ round: 1, status: 'passed', threads: [] }), thorough, false, true)).toMatchObject({ next: 'close', decision: 'proceed' });
    expect(routeNext(published({ round: 0, status: 'pending', threads: [] }), thorough, false, true)).toMatchObject({ next: 'close', decision: 'proceed' });
    expect(routeNext(published(), thorough, false, true)).toMatchObject({ next: 'close', decision: 'proceed' });
  });

  it('ignores bot state when the seat is unwired', () => {
    expect(routeNext(published({ round: 0, status: 'changes_requested', threads: [] }), thorough, false, false)).toMatchObject({ next: 'close', decision: 'proceed' });
    expect(routeNext(published({ round: 0, status: 'changes_requested', threads: [] }), thorough, false)).toMatchObject({ next: 'close', decision: 'proceed' });
  });

  it('unit route returns respond without moving the stage, and the pilot brief describes the loop', async () => {
    const ctx = await unitCtx(BOT_CONFIG);
    const dir = unitDirFor(ctx, 'RB-1');
    writeState(dir, { ...readState(dir), stage: 'publish', challenge_passed: true });
    await dispatch(reviewbotTool, { action: 'ready', id: 'RB-1' }, ctx);
    await dispatch(reviewbotTool, { action: 'poll', id: 'RB-1', status: 'changes_requested' }, ctx);
    await dispatch(unitTool, { action: 'report', id: 'RB-1', stage: 'publish', outcome: 'done', summary: 'opened' }, ctx);
    const route = await dispatch(unitTool, { action: 'route', id: 'RB-1' }, ctx);
    expect(route.envelope.ok).toBe(true);
    expect(route.envelope.data).toMatchObject({ next: 'respond', decision: 'proceed' });
    expect(readState(dir).stage).toBe('publish');
    const pilot = await dispatch(unitTool, { action: 'brief', id: 'RB-1', stage: 'pilot', quiet: true }, ctx);
    expect(pilot.text).toMatch(/review-bot loop/i);
    expect(pilot.text).toContain('reviewbot ready');
    expect(pilot.text).toContain('reviewbot poll');
    expect(pilot.text).toContain('reviewbot round');
    const unwired: HarnessConfig = DEFAULTS;
    expect(unwired.seats?.reviewbot?.status).toEqual([]);
  });
});
