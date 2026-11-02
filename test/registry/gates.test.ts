import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import type { HarnessConfig } from '../../src/config/schema.js';
import { defineGate, resolveGates, transitionAllowed, type GateContext, type GateDef } from '../../src/registry/gates.js';
import { resolveMode, type ModeDef } from '../../src/modes.js';
import { createState } from '../../src/store/state.js';
import { makeTmpDir } from '../helpers/tmp.js';

function ctx(config: HarnessConfig = DEFAULTS, worktree: string | null = null): GateContext {
  const state = createState({ id: 'ABC-1', repo: 'local/x', tracked: true, source: { kind: 'ticket', ref: 'ABC-1', pinned: false }, mode: 'thorough', base_branch: 'main' });
  return { state, config, unitDir: makeTmpDir('harness-unit'), worktree };
}

const thorough: ModeDef = resolveMode('thorough', DEFAULTS);

const passing: GateDef = defineGate({ id: 'fake_pass', stage: 'build', description: 'always passes', severity: 'block', check: () => ({ pass: true }) });
const failing: GateDef = defineGate({ id: 'fake_fail', stage: 'build', description: 'always fails', severity: 'block', check: () => ({ pass: false, remedy: 'do the thing' }) });
const needsBrowser: GateDef = defineGate({ id: 'fake_browser', stage: 'pr', description: 'needs browser_ui', severity: 'block', requires: 'browser_ui', check: () => ({ pass: false, remedy: 'walk through' }) });
const warning: GateDef = defineGate({ id: 'fake_warn', stage: 'build', description: 'warns', severity: 'warn', check: async () => ({ pass: false, remedy: 'consider it' }) });

describe('resolveGates', () => {
  it('only resolves gates for the requested stage and runs their checks', async () => {
    const out = await resolveGates('build', ctx(), thorough, [passing, failing, needsBrowser]);
    expect(out.map((g) => g.id)).toEqual(['fake_pass', 'fake_fail']);
    expect(out[0]).toMatchObject({ severity: 'block', status: 'pass' });
    expect(out[1]).toMatchObject({ severity: 'block', status: 'fail', remedy: 'do the thing' });
  });

  it('marks a gate n/a when its required capability is absent, pass/fail when present', async () => {
    const absent = await resolveGates('pr', ctx(), thorough, [needsBrowser]);
    expect(absent[0]).toMatchObject({ id: 'fake_browser', status: 'n/a' });
    const withCap: HarnessConfig = { ...DEFAULTS, repos: { 'local/x': { capabilities: { browser_ui: true } } } };
    const present = await resolveGates('pr', ctx(withCap), thorough, [needsBrowser]);
    expect(present[0]).toMatchObject({ id: 'fake_browser', status: 'fail', severity: 'block' });
  });

  it('applies config severity overrides', async () => {
    const config: HarnessConfig = { ...DEFAULTS, gates: { fake_fail: { severity: 'warn' } } };
    const out = await resolveGates('build', ctx(config), thorough, [failing]);
    expect(out[0]).toMatchObject({ severity: 'warn', status: 'fail', demoted_by: 'config' });
  });

  it('applies mode demotion downward only', async () => {
    const demoting: ModeDef = { ...thorough, name: 'm', demote: { fake_fail: 'warn', fake_warn: 'block' } };
    const out = await resolveGates('build', ctx(), demoting, [failing, warning]);
    expect(out.find((g) => g.id === 'fake_fail')).toMatchObject({ severity: 'warn', demoted_by: 'mode' });
    const warn = out.find((g) => g.id === 'fake_warn')!;
    expect(warn.severity).toBe('warn');
    expect(warn.demoted_by).toBeUndefined();
  });

  it('turns off gates without running them', async () => {
    let ran = false;
    const spy: GateDef = defineGate({ id: 'spy', stage: 'build', description: 's', severity: 'block', check: () => { ran = true; return { pass: false }; } });
    const off: ModeDef = { ...thorough, name: 'm', demote: { spy: 'off' } };
    const out = await resolveGates('build', ctx(), off, [spy]);
    expect(out[0]).toMatchObject({ severity: 'off', status: 'n/a' });
    expect(ran).toBe(false);
  });

  it('runs custom shell gates in the worktree and reports stderr as the remedy', async () => {
    const worktree = makeTmpDir('harness-wt');
    const config: HarnessConfig = {
      ...DEFAULTS,
      custom_gates: [
        { id: 'custom_fail', stage: 'build', command: 'echo "custom says no" 1>&2; exit 1', severity: 'block' },
        { id: 'custom_pass', stage: 'build', command: 'test "$(pwd -P)" = "$(cd \'' + worktree + '\' && pwd -P)"' },
        { id: 'elsewhere', stage: 'review', command: 'exit 1' },
      ],
    };
    const out = await resolveGates('build', ctx(config, worktree), thorough, []);
    expect(out.map((g) => g.id)).toEqual(['custom_fail', 'custom_pass']);
    expect(out[0]).toMatchObject({ severity: 'block', status: 'fail' });
    expect(out[0]!.remedy).toContain('custom says no');
    expect(out[1]).toMatchObject({ severity: 'warn', status: 'pass' });
  });
});

describe('transitionAllowed', () => {
  it('blocks on a failing block gate and allows failing warn gates', () => {
    const blocked = transitionAllowed([
      { id: 'a', severity: 'block', status: 'fail', remedy: 'x' },
      { id: 'b', severity: 'warn', status: 'fail' },
      { id: 'c', severity: 'block', status: 'pass' },
    ]);
    expect(blocked.ok).toBe(false);
    expect(blocked.blocking.map((g) => g.id)).toEqual(['a']);
    expect(blocked.warnings.map((g) => g.id)).toEqual(['b']);
    const allowed = transitionAllowed([
      { id: 'b', severity: 'warn', status: 'fail' },
      { id: 'c', severity: 'block', status: 'pass' },
      { id: 'd', severity: 'block', status: 'n/a' },
      { id: 'e', severity: 'off', status: 'n/a' },
    ]);
    expect(allowed.ok).toBe(true);
    expect(allowed.blocking).toEqual([]);
    expect(allowed.warnings.map((g) => g.id)).toEqual(['b']);
  });
});
