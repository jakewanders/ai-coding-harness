import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCommand } from '../../src/exec/run.js';
import { dispatch } from '../../src/registry/tools.js';
import { expandHome } from '../../src/store/paths.js';
import { readState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { execTool } from '../../src/tools/exec.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

async function unitCtx(files: Record<string, string> = { 'README.md': 'x' }, id = 'ABC-1') {
  const ctx = makeCtx({ cwd: makeRepo(files) });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id }, ctx);
  return ctx;
}

describe('runCommand', () => {
  it('captures stdout, stderr and the exit code', async () => {
    const r = await runCommand('echo out; echo err 1>&2; exit 3', { cwd: process.env.HARNESS_HOME!, timeoutMs: 5000 });
    expect(r).toMatchObject({ exit: 3, timedOut: false });
    expect(r.stdout.trim()).toBe('out');
    expect(r.stderr.trim()).toBe('err');
  });

  it('kills a command that exceeds the timeout', async () => {
    const r = await runCommand('sleep 5', { cwd: process.env.HARNESS_HOME!, timeoutMs: 100 });
    expect(r.timedOut).toBe(true);
    expect(r.exit).not.toBe(0);
  });

  it('runs in the given cwd with extra env', async () => {
    const dir = process.env.HARNESS_HOME!;
    const r = await runCommand('pwd -P; echo "$HARNESS_X"', { cwd: dir, timeoutMs: 5000, env: { HARNESS_X: 'set' } });
    expect(r.stdout.trim().split('\n')).toEqual([fs.realpathSync(dir), 'set']);
  });
});

describe('exec run', () => {
  it('records a successful run with its log, stored home-relative', async () => {
    const base = await unitCtx();
    const vault = path.join(process.env.HARNESS_HOME!, '.harness', 'vault');
    const ctx = makeCtx({ cwd: base.cwd, vault });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'ABC-1' }, ctx);
    const r = await dispatch(execTool, { action: 'run', id: 'ABC-1', command: 'echo hi' }, ctx);
    expect(r.envelope.ok).toBe(true);
    const data = r.envelope.data as { run: string; exit: number; log: string; summary: string; timedOut: boolean };
    expect(data.exit).toBe(0);
    expect(data.timedOut).toBe(false);
    expect(data.summary).toContain('hi');
    const logAbs = expandHome(data.log);
    expect(fs.readFileSync(logAbs, 'utf8')).toContain('hi');
    expect(logAbs.startsWith(path.join(unitDirFor(ctx, 'ABC-1'), 'runs'))).toBe(true);
    const state = readState(unitDirFor(ctx, 'ABC-1'));
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0]).toMatchObject({ id: data.run, command: 'echo hi', exit: 0 });
    expect(state.runs[0]!.log.startsWith('~/')).toBe(true);
    expect(r.text).toContain('hi');
  });

  it('records a failing exit code and marks the envelope not ok', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(execTool, { action: 'run', id: 'ABC-1', command: 'echo nope 1>&2; exit 2' }, ctx);
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.data).toMatchObject({ exit: 2, timedOut: false });
    expect((r.envelope.data as { summary: string }).summary).toContain('nope');
    expect(readState(unitDirFor(ctx, 'ABC-1')).runs[0]!.exit).toBe(2);
  });

  it('records a timeout', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(execTool, { action: 'run', id: 'ABC-1', command: 'sleep 5', timeoutMs: 100 }, ctx);
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.data).toMatchObject({ timedOut: true });
    expect(readState(unitDirFor(ctx, 'ABC-1')).runs[0]!.summary).toMatch(/timed out/i);
  });

  it('runs a named profile command from config', async () => {
    const ctx = await unitCtx({ 'README.md': 'x', '.harness.yaml': 'schema: 1\nrepos:\n  local/__NS__:\n    commands:\n      test: echo config-test\n' });
    const state = readState(unitDirFor(ctx, 'ABC-1'));
    fs.writeFileSync(path.join(ctx.cwd, '.harness.yaml'), `schema: 1\nrepos:\n  "${state.repo}":\n    commands:\n      test: echo config-test\n`);
    const ctx2 = makeCtx({ cwd: ctx.cwd });
    const r = await dispatch(execTool, { action: 'run', id: 'ABC-1', name: 'test' }, ctx2);
    expect(r.envelope.ok).toBe(true);
    expect((r.envelope.data as { summary: string }).summary).toContain('config-test');
    expect(readState(unitDirFor(ctx2, 'ABC-1')).runs[0]!.command).toBe('echo config-test');
    const unknown = await dispatch(execTool, { action: 'run', id: 'ABC-1', name: 'e2e' }, ctx2);
    expect(unknown.envelope.ok).toBe(false);
    expect(unknown.envelope.summary).toContain('e2e');
  });

  it('requires exactly one of name and command', async () => {
    const ctx = await unitCtx();
    const neither = await dispatch(execTool, { action: 'run', id: 'ABC-1' }, ctx);
    expect(neither.envelope.ok).toBe(false);
    expect(neither.envelope.summary).toMatch(/name/);
    expect(neither.envelope.summary).toMatch(/command/);
    const both = await dispatch(execTool, { action: 'run', id: 'ABC-1', name: 'test', command: 'echo' }, ctx);
    expect(both.envelope.ok).toBe(false);
    expect(readState(unitDirFor(ctx, 'ABC-1')).runs).toHaveLength(0);
  });
});

describe('exec commands', () => {
  it('returns inferred commands with evidence when the repo has no config', async () => {
    const ctx = await unitCtx({ 'package.json': JSON.stringify({ scripts: { test: 'vitest run', lint: 'eslint .' } }), 'package-lock.json': '{}' });
    const r = await dispatch(execTool, { action: 'commands', id: 'ABC-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    const data = r.envelope.data as { inferred: boolean; commands: Record<string, string>; evidence: Record<string, string> };
    expect(data.inferred).toBe(true);
    expect(data.commands.test).toBe('npm test');
    expect(data.commands.lint).toBe('npm run lint');
    expect(data.evidence.test).toContain('scripts.test');
  });

  it('returns configured commands flagged as not inferred', async () => {
    const ctx = await unitCtx();
    const state = readState(unitDirFor(ctx, 'ABC-1'));
    fs.writeFileSync(path.join(ctx.cwd, '.harness.yaml'), `schema: 1\nrepos:\n  "${state.repo}":\n    commands:\n      check: make check\n`);
    const r = await dispatch(execTool, { action: 'commands', id: 'ABC-1' }, makeCtx({ cwd: ctx.cwd }));
    expect(r.envelope.data).toMatchObject({ inferred: false, commands: { check: 'make check' } });
  });
});

describe('exec logs', () => {
  it('returns the tail of a recorded run and fails for an unknown run', async () => {
    const ctx = await unitCtx();
    const run = await dispatch(execTool, { action: 'run', id: 'ABC-1', command: 'for i in 1 2 3 4 5; do echo line$i; done' }, ctx);
    const runId = (run.envelope.data as { run: string }).run;
    const all = await dispatch(execTool, { action: 'logs', id: 'ABC-1', run: runId }, ctx);
    expect(all.envelope.ok).toBe(true);
    expect(all.text).toContain('line1');
    expect(all.text).toContain('line5');
    const tail = await dispatch(execTool, { action: 'logs', id: 'ABC-1', run: runId, tail: 2 }, ctx);
    expect(tail.text).not.toContain('line3');
    expect(tail.text).toContain('line5');
    const missing = await dispatch(execTool, { action: 'logs', id: 'ABC-1', run: 'nope' }, ctx);
    expect(missing.envelope.ok).toBe(false);
  });
});
