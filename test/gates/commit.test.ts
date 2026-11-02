import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import type { HarnessConfig } from '../../src/config/schema.js';
import '../../src/gates/index.js';
import { allGates, resolveGates, type GateContext } from '../../src/registry/gates.js';
import { resolveMode } from '../../src/modes.js';
import { createState, type EvidenceRecord, type RunRecord, type UnitState } from '../../src/store/state.js';
import { makeTmpDir } from '../helpers/tmp.js';

const thorough = resolveMode('thorough', DEFAULTS);
const at = '2026-09-04T00:00:00.000Z';

function base(over: Partial<UnitState> = {}): UnitState {
  return { ...createState({ id: 'G-1', repo: 'local/x', tracked: true, source: { kind: 'ticket', ref: 'G-1', pinned: false }, mode: 'thorough', base_branch: 'main' }), stage: 'build', ...over };
}

function ev(kind: EvidenceRecord['kind'], payload: unknown, cycle = 0): EvidenceRecord {
  return { kind, cycle, recorded_at: at, payload };
}

function run(command: string, exit: number, cycle = 0): RunRecord {
  return { id: `r-${command}-${exit}`, command, exit, summary: '', log: '~/l.log', started_at: at, ended_at: at, cycle };
}

async function gate(id: string, state: UnitState, config: HarnessConfig = DEFAULTS) {
  const ctx: GateContext = { state, config, unitDir: makeTmpDir('harness-gate'), worktree: null };
  const all = await resolveGates(state.stage, ctx, thorough);
  const g = all.find((x) => x.id === id);
  if (!g) throw new Error(`gate ${id} not resolved for ${state.stage}`);
  return g;
}

describe('registered gates', () => {
  it('includes the commit and wrap_up gates with their default severities', () => {
    const ids = Object.fromEntries(allGates().map((g) => [g.id, g]));
    expect(ids.check_command_green).toMatchObject({ stage: 'build', severity: 'block' });
    expect(ids.self_critique_recorded).toMatchObject({ stage: 'build', severity: 'block' });
    expect(ids.defect_repro_before_fix).toMatchObject({ stage: 'build', severity: 'block' });
    expect(ids.pii_audit_clean).toMatchObject({ stage: 'build', severity: 'block' });
    expect(ids.pr_recorded).toMatchObject({ stage: 'wrap_up', severity: 'block' });
    expect(ids.review_verdict_ship).toMatchObject({ stage: 'review', severity: 'block' });
    expect(ids.ledger_reverified).toMatchObject({ stage: 'review', severity: 'warn' });
    expect(ids.walkthrough_done).toMatchObject({ stage: 'pr', severity: 'block', requires: 'browser_ui' });
    expect(Object.keys(ids).sort()).toEqual([
      'check_command_green', 'claims_audited', 'criteria_validated', 'defect_repro_before_fix', 'ledger_reverified',
      'pii_audit_clean', 'pr_recorded', 'review_verdict_ship', 'self_critique_recorded', 'walkthrough_done',
    ]);
  });
});

describe('self_critique_recorded', () => {
  it('fails without a record, passes with an empty findings list in this cycle only', async () => {
    expect(await gate('self_critique_recorded', base())).toMatchObject({ status: 'fail' });
    expect((await gate('self_critique_recorded', base())).remedy).toMatch(/self_critique/);
    expect(await gate('self_critique_recorded', base({ evidence: [ev('self_critique', { findings: [] })] }))).toMatchObject({ status: 'pass' });
    expect(await gate('self_critique_recorded', base({ cycle: 1, evidence: [ev('self_critique', { findings: [] }, 0)] }))).toMatchObject({ status: 'fail' });
  });
});

describe('check_command_green', () => {
  const config: HarnessConfig = { ...DEFAULTS, repos: { 'local/x': { commands: { check: 'make check', test: 'make test' } } } };

  it('passes when the latest check run in this cycle exited 0', async () => {
    expect(await gate('check_command_green', base(), config)).toMatchObject({ status: 'fail' });
    expect(await gate('check_command_green', base({ runs: [run('make check', 0)] }), config)).toMatchObject({ status: 'pass' });
    expect(await gate('check_command_green', base({ runs: [run('make check', 0), run('make check', 1)] }), config)).toMatchObject({ status: 'fail' });
    expect(await gate('check_command_green', base({ runs: [run('make check', 1), run('make check', 0)] }), config)).toMatchObject({ status: 'pass' });
    expect(await gate('check_command_green', base({ cycle: 1, runs: [run('make check', 0, 0)] }), config)).toMatchObject({ status: 'fail' });
  });

  it('falls back to the test command when no check command is configured, then to any run', async () => {
    const testOnly: HarnessConfig = { ...DEFAULTS, repos: { 'local/x': { commands: { test: 'make test' } } } };
    expect(await gate('check_command_green', base({ runs: [run('make test', 0)] }), testOnly)).toMatchObject({ status: 'pass' });
    expect(await gate('check_command_green', base({ runs: [run('make lint', 0)] }), testOnly)).toMatchObject({ status: 'fail' });
    expect(await gate('check_command_green', base({ runs: [run('anything', 0)] }))).toMatchObject({ status: 'pass' });
    const r = await gate('check_command_green', base({ runs: [run('anything', 2)] }));
    expect(r.status).toBe('fail');
    expect(r.remedy).toMatch(/exec run/);
  });
});

describe('defect_repro_before_fix', () => {
  it('is n/a for non-bugs, fails for a bug without a record, passes with red output or a waiver', async () => {
    expect(await gate('defect_repro_before_fix', base({ kind: 'feature' }))).toMatchObject({ status: 'n/a' });
    expect(await gate('defect_repro_before_fix', base({ kind: 'bug' }))).toMatchObject({ status: 'fail' });
    expect(await gate('defect_repro_before_fix', base({ kind: 'bug', evidence: [ev('defect_repro', { test_location: 't', command: 'c', red_output: '' })] }))).toMatchObject({ status: 'fail' });
    expect(await gate('defect_repro_before_fix', base({ kind: 'bug', evidence: [ev('defect_repro', { test_location: 't', command: 'c', red_output: 'FAIL' })] }))).toMatchObject({ status: 'pass' });
    expect(await gate('defect_repro_before_fix', base({ kind: 'bug', evidence: [ev('waiver', { gate: 'defect_repro_before_fix', rationale: 'flaky infra' })] }))).toMatchObject({ status: 'pass' });
    expect(await gate('defect_repro_before_fix', base({ kind: 'bug', evidence: [ev('waiver', { gate: 'pii_audit_clean', rationale: 'other gate' })] }))).toMatchObject({ status: 'fail' });
  });
});

describe('pii_audit_clean', () => {
  it('passes with a zero-finding pii record or a waiver, fails otherwise', async () => {
    expect(await gate('pii_audit_clean', base())).toMatchObject({ status: 'fail' });
    expect(await gate('pii_audit_clean', base({ evidence: [ev('pii', { findings: [] })] }))).toMatchObject({ status: 'pass' });
    const dirty = await gate('pii_audit_clean', base({ evidence: [ev('pii', { findings: [{ file: 'a', line: 1, sink: 'log', text: 'email' }] })] }));
    expect(dirty.status).toBe('fail');
    expect(dirty.remedy).toMatch(/1 finding/);
    expect(await gate('pii_audit_clean', base({ evidence: [ev('pii', { findings: [{ file: 'a', line: 1, sink: 'log', text: 'email' }] }), ev('waiver', { gate: 'pii_audit_clean', rationale: 'fixture' })] }))).toMatchObject({ status: 'pass' });
    expect(await gate('pii_audit_clean', base({ cycle: 1, evidence: [ev('pii', { findings: [] }, 0)] }))).toMatchObject({ status: 'fail' });
  });
});

describe('pr_recorded', () => {
  it('passes only when state.pr is set', async () => {
    expect(await gate('pr_recorded', base({ stage: 'wrap_up' }))).toMatchObject({ status: 'fail' });
    const pr = { url: 'https://example.test/pr/1', number: 1, base: 'main', head: 'G-1', opened_at: at, threads: [] };
    expect(await gate('pr_recorded', base({ stage: 'wrap_up', pr }))).toMatchObject({ status: 'pass' });
  });
});
