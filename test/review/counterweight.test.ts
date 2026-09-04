import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import { dotenvPath, loadDotenv } from '../../src/config/dotenv.js';
import type { HarnessConfig } from '../../src/config/schema.js';
import { resolveMode } from '../../src/modes.js';
import { resolveCounterweight, trackFindings, type CounterweightRecord, type Finding } from '../../src/review/counterweight.js';
import { defineGate, resolveGates, type GateContext } from '../../src/registry/gates.js';
import '../../src/gates/index.js';
import { createState } from '../../src/store/state.js';
import { makeTmpDir } from '../helpers/tmp.js';

describe('loadDotenv', () => {
  it('parses KEY=value lines, strips quotes and comments, tolerates a missing file', () => {
    const file = path.join(makeTmpDir('harness-dotenv'), '.env');
    fs.writeFileSync(file, '# comment\nCOUNTERWEIGHT_API_KEY="sk-123"\nexport OTHER=\'x y\'\nPLAIN=value # trailing\nEMPTY=\nBAD LINE\n');
    expect(loadDotenv(file)).toEqual({ COUNTERWEIGHT_API_KEY: 'sk-123', OTHER: 'x y', PLAIN: 'value', EMPTY: '' });
    expect(loadDotenv(path.join(file, 'nope'))).toEqual({});
    expect(dotenvPath({ HARNESS_HOME: '/h' })).toBe('/h/.harness/.env');
  });
});

function withSeat(cli: string | null, http: string | null): HarnessConfig {
  return { ...DEFAULTS, seats: { ...DEFAULTS.seats, counterweight: { cli, http } } };
}

function homeWithKey(key: string | null): NodeJS.ProcessEnv {
  const home = makeTmpDir('harness-cw-home');
  fs.mkdirSync(path.join(home, '.harness'), { recursive: true });
  if (key) fs.writeFileSync(path.join(home, '.harness', '.env'), `COUNTERWEIGHT_API_KEY=${key}\n`);
  return { HARNESS_HOME: home };
}

describe('resolveCounterweight', () => {
  it('prefers the CLI and runs it through the injected exec with the prompt', async () => {
    const calls: Array<{ cmd: string; env?: Record<string, string> }> = [];
    const exec = async (cmd: string, opts: { cwd: string; timeoutMs: number; env?: Record<string, string> }) => {
      calls.push({ cmd, env: opts.env });
      return { exit: 0, stdout: 'cli says fine', stderr: '', timedOut: false };
    };
    const p = resolveCounterweight(withSeat('second-opinion --review', 'https://cw.example.test/review'), homeWithKey('k'), { exec });
    expect(p.kind).toBe('cli');
    expect(p.describe()).toContain('second-opinion');
    expect(await p.review('look at this')).toBe('cli says fine');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.cmd).toBe('second-opinion --review');
    expect(calls[0]!.env?.COUNTERWEIGHT_PROMPT).toBe('look at this');
  });

  it('uses HTTP with the dotenv key and the injected fetch, never the global one', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error('global fetch must not be called'); }) as unknown as typeof fetch;
    try {
      const seen: Array<{ url: string; init: RequestInit }> = [];
      const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
        seen.push({ url: String(url), init: init ?? {} });
        return new Response('http says ok', { status: 200 });
      }) as typeof fetch;
      const p = resolveCounterweight(withSeat(null, 'https://cw.example.test/review'), homeWithKey('sk-abc'), { fetch: fetchImpl });
      expect(p.kind).toBe('http');
      expect(await p.review('prompt text')).toBe('http says ok');
      expect(seen).toHaveLength(1);
      expect(seen[0]!.url).toBe('https://cw.example.test/review');
      expect((seen[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer sk-abc');
      expect(JSON.parse(String(seen[0]!.init.body))).toEqual({ prompt: 'prompt text' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('falls back to the stub when http has no key or nothing is configured', async () => {
    const noKey = resolveCounterweight(withSeat(null, 'https://cw.example.test/review'), homeWithKey(null), {});
    expect(noKey.kind).toBe('fallback-stub');
    const none = resolveCounterweight(withSeat(null, null), homeWithKey('k'), {});
    expect(none.kind).toBe('fallback-stub');
    const text = await none.review('anything');
    expect(text).toContain('provider: fallback-stub');
    expect(none.describe()).toContain('fallback-stub');
  });

  it('reports a failing CLI as an error text rather than throwing', async () => {
    const exec = async () => ({ exit: 2, stdout: '', stderr: 'boom', timedOut: false });
    const p = resolveCounterweight(withSeat('bad-cli', null), homeWithKey(null), { exec });
    await expect(p.review('x')).rejects.toThrow(/boom/);
  });
});

describe('trackFindings', () => {
  const f = (severity: Finding['severity'], text: string): Finding => ({ severity, text });
  const rec = (...findings: Finding[]): CounterweightRecord => ({ provider: 'cli', findings });

  it('classes findings by severity and first three words, caps a class after three prior cycles', () => {
    const previous = [rec(f('major', 'Missing null check on user')), rec(f('major', 'missing NULL check in handler')), rec(f('major', 'Missing null check again'))];
    const current = [f('major', 'Missing null check on session'), f('minor', 'Rename helper for clarity')];
    const r = trackFindings(previous, current);
    expect(r.capped).toEqual([{ class: 'major:missing null check', count: 4 }]);
    expect(r.active).toEqual([{ severity: 'minor', text: 'Rename helper for clarity', class: 'minor:rename helper for' }]);
  });

  it('keeps a class active while under the cap and honours a custom cap', () => {
    const previous = [rec(f('blocker', 'SQL injection in search')), rec(f('blocker', 'sql injection in export'))];
    const r = trackFindings(previous, [f('blocker', 'SQL injection in login')]);
    expect(r.capped).toEqual([]);
    expect(r.active.map((a) => a.class)).toEqual(['blocker:sql injection in']);
    const tight = trackFindings(previous, [f('blocker', 'SQL injection in login')], 2);
    expect(tight.capped).toEqual([{ class: 'blocker:sql injection in', count: 3 }]);
    expect(tight.active).toEqual([]);
    expect(trackFindings([], [])).toEqual({ active: [], capped: [] });
  });
});

describe('counterweight_consulted gate', () => {
  const state = { ...createState({ id: 'CW-1', repo: 'local/x', tracked: true, source: { kind: 'ticket', ref: 'CW-1', pinned: false }, mode: 'thorough', base_branch: 'main' }), stage: 'review' as const };
  const ctx = (config: HarnessConfig): GateContext => ({ state, config, unitDir: makeTmpDir('harness-cw'), worktree: null });

  it('is n/a when the seat is unwired, fails when wired without a record, passes with one', async () => {
    const mode = resolveMode('thorough', DEFAULTS);
    const unwired = (await resolveGates('review', ctx(DEFAULTS), mode)).find((g) => g.id === 'counterweight_consulted')!;
    expect(unwired).toMatchObject({ severity: 'warn', status: 'n/a' });
    const wired = withSeat('second-opinion', null);
    const missing = (await resolveGates('review', ctx(wired), mode)).find((g) => g.id === 'counterweight_consulted')!;
    expect(missing.status).toBe('fail');
    expect(missing.remedy).toMatch(/counterweight/);
    const withRecord: GateContext = { ...ctx(wired), state: { ...state, evidence: [{ kind: 'counterweight', cycle: 0, recorded_at: '2026-09-04T00:00:00.000Z', payload: { provider: 'cli', findings: [] } }] } };
    expect((await resolveGates('review', withRecord, mode)).find((g) => g.id === 'counterweight_consulted')!.status).toBe('pass');
  });

  it('supports seat requirements on any gate', async () => {
    const fake = defineGate({ id: 'needs_chat', stage: 'review', description: 'x', severity: 'block', requires: 'seat:chat', check: () => ({ pass: true }) });
    const mode = resolveMode('thorough', DEFAULTS);
    expect((await resolveGates('review', ctx(DEFAULTS), mode, [fake]))[0]).toMatchObject({ status: 'n/a' });
    const chat: HarnessConfig = { ...DEFAULTS, seats: { ...DEFAULTS.seats, chat: { post: ['mcp__chat__post'] } } };
    expect((await resolveGates('review', ctx(chat), mode, [fake]))[0]).toMatchObject({ status: 'pass' });
  });
});
