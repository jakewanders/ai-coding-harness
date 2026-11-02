import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import { credentialsFor, selectEnvironment } from '../../src/config/environments.js';
import type { HarnessConfig } from '../../src/config/schema.js';
import { EVIDENCE_KINDS } from '../../src/evidence/kinds.js';
import '../../src/gates/index.js';
import { resolveMode } from '../../src/modes.js';
import { resolveGates, type GateContext } from '../../src/registry/gates.js';
import { dispatch } from '../../src/registry/tools.js';
import { createState, readState, writeState, type EvidenceRecord, type UnitState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { specTool } from '../../src/tools/spec.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';
import { makeTmpDir } from '../helpers/tmp.js';

const envs: HarnessConfig['environments'] = [
  { name: 'prod', url: 'https://app.example.test', role: 'production', env_prefix: 'PROD_' },
  { name: 'staging', url: 'https://ref.example.test', role: 'reference', env_prefix: 'REF_' },
  { name: 'qa', url: 'https://qa.example.test', role: 'sut', env_prefix: 'QA_' },
];

describe('selectEnvironment / credentialsFor', () => {
  it('picks by role regardless of order and returns null when absent', () => {
    const config: HarnessConfig = { ...DEFAULTS, environments: envs };
    expect(selectEnvironment(config, 'sut')?.name).toBe('qa');
    expect(selectEnvironment(config, 'reference')?.name).toBe('staging');
    expect(selectEnvironment(config, 'production')?.name).toBe('prod');
    expect(selectEnvironment(DEFAULTS, 'sut')).toBeNull();
    expect(selectEnvironment({ ...DEFAULTS, environments: [{ name: 'only', url: 'x' }] }, 'sut')).toBeNull();
  });

  it('resolves credentials by prefix only', () => {
    const dotenv = { QA_USER: 'tester', QA_PASSWORD: 'supersecret', REF_USER: 'ref', UNRELATED: 'x' };
    expect(credentialsFor(envs![2]!, dotenv)).toEqual({ QA_USER: 'tester', QA_PASSWORD: 'supersecret' });
    expect(credentialsFor(envs![1]!, dotenv)).toEqual({ REF_USER: 'ref' });
    expect(credentialsFor({ name: 'none', url: 'x' }, dotenv)).toEqual({});
  });
});

describe('browser_findings schema', () => {
  it('accepts the per-criterion shape and rejects the old findings shape', () => {
    const ok = { criteria: [{ id: 'AC-1', result: 'pass', notes: 'fine', screenshots: ['~/shots/1.png'] }], runtime_errors: [], e2e: { command: 'npm run e2e', exit: 0 }, out_of_scope: ['footer misaligned'] };
    expect(EVIDENCE_KINDS.browser_findings.schema.safeParse(ok).success).toBe(true);
    expect(EVIDENCE_KINDS.browser_findings.schema.safeParse({ ...ok, e2e: null }).success).toBe(true);
    expect(EVIDENCE_KINDS.browser_findings.schema.safeParse({ criteria: [{ id: 'AC-1', result: 'meh', notes: '', screenshots: [] }], runtime_errors: [], e2e: null, out_of_scope: [] }).success).toBe(false);
    expect(EVIDENCE_KINDS.browser_findings.schema.safeParse({ environment: 'qa', findings: [] }).success).toBe(false);
  });
});

describe('walkthrough_done gate', () => {
  const mode = resolveMode('thorough', DEFAULTS);
  const withUi: HarnessConfig = { ...DEFAULTS, repos: { 'local/x': { capabilities: { browser_ui: true } } } };
  function state(evidence: EvidenceRecord[] = []): UnitState {
    return { ...createState({ id: 'VF-1', repo: 'local/x', tracked: true, source: { kind: 'ticket', ref: 'VF-1', pinned: true }, mode: 'thorough', base_branch: 'main' }), stage: 'pr', evidence };
  }
  const findings = (results: Array<'pass' | 'fail' | 'blocked'>, out_of_scope: string[] = []): EvidenceRecord => ({
    kind: 'browser_findings', cycle: 0, recorded_at: '2026-09-04T00:00:00.000Z',
    payload: { criteria: results.map((result, i) => ({ id: `AC-${i + 1}`, result, notes: '', screenshots: [] })), runtime_errors: [], e2e: null, out_of_scope },
  });
  async function gate(config: HarnessConfig, s: UnitState) {
    const ctx: GateContext = { state: s, config, unitDir: makeTmpDir('harness-vf'), worktree: null };
    return (await resolveGates('pr', ctx, mode)).find((g) => g.id === 'walkthrough_done')!;
  }

  it('is n/a without browser_ui, fails without a record or with a failing criterion, passes when all pass', async () => {
    expect(await gate(DEFAULTS, state())).toMatchObject({ severity: 'block', status: 'n/a' });
    expect((await gate(withUi, state())).status).toBe('fail');
    const failing = await gate(withUi, state([findings(['pass', 'fail'])]));
    expect(failing.status).toBe('fail');
    expect(failing.remedy).toContain('AC-2');
    expect((await gate(withUi, state([findings(['pass', 'blocked'])]))).status).toBe('fail');
    expect((await gate(withUi, state([findings([])]))).status).toBe('fail');
    expect((await gate(withUi, state([findings(['pass', 'pass'])]))).status).toBe('pass');
  });

  it('ignores out-of-scope observations', async () => {
    expect((await gate(withUi, state([findings(['pass'], ['the footer is misaligned', 'console warning on load'])]))).status).toBe('pass');
    expect((await gate(withUi, state([findings(['fail'], [])]))).status).toBe('fail');
  });
});

describe('walkthrough brief', () => {
  it('lists criteria with edge-case prompts, environments by role, e2e command, screenshot and scope rules, never credential values', async () => {
    const yaml = [
      'schema: 1',
      'repos:',
      '  "__NS__":',
      '    commands:',
      '      e2e: npm run e2e',
      '    capabilities:',
      '      browser_ui: true',
      'environments:',
      '  - { name: staging, url: "https://ref.example.test", role: reference, env_prefix: REF_ }',
      '  - { name: qa, url: "https://qa.example.test", role: sut, env_prefix: QA_ }',
      '',
    ].join('\n');
    const repo = makeRepo({ 'README.md': 'x' });
    const probe = makeCtx({ cwd: repo });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'VF-2' }, probe);
    const ns = readState(unitDirFor(probe, 'VF-2')).repo;
    fs.writeFileSync(path.join(repo, '.harness.yaml'), yaml.replace('__NS__', ns));
    const home = process.env.HARNESS_HOME!;
    fs.mkdirSync(path.join(home, '.harness'), { recursive: true });
    fs.writeFileSync(path.join(home, '.harness', '.env'), 'QA_USER=tester\nQA_PASSWORD=supersecret\nREF_TOKEN=reftoken\n');
    const ctx = makeCtx({ cwd: repo });
    await dispatch(specTool, { action: 'record', id: 'VF-2', title: 'Export button', body: 'Add export.' }, ctx);
    await dispatch(specTool, { action: 'criteria', id: 'VF-2', set: ['Button visible on the orders page', 'CSV downloads with all rows'] }, ctx);
    const dir = unitDirFor(ctx, 'VF-2');
    writeState(dir, { ...readState(dir), stage: 'walkthrough' });
    const r = await dispatch(unitTool, { action: 'brief', id: 'VF-2', stage: 'walkthrough', quiet: true }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('AC-1: Button visible on the orders page');
    expect(r.text).toContain('AC-2: CSV downloads with all rows');
    expect(r.text).toMatch(/edge cases/i);
    expect(r.text).toContain('https://qa.example.test');
    expect(r.text).toMatch(/sut/);
    expect(r.text).toContain('https://ref.example.test');
    expect(r.text).toMatch(/reference/);
    expect(r.text).toContain('QA_USER');
    expect(r.text).toContain('QA_PASSWORD');
    expect(r.text).not.toContain('supersecret');
    expect(r.text).not.toContain('tester');
    expect(r.text).not.toContain('reftoken');
    expect(r.text).toContain('npm run e2e');
    expect(r.text).toMatch(/screenshots?/i);
    expect(r.text).toMatch(/attach/i);
    expect(r.text).toContain('out_of_scope');
    expect(r.text).toMatch(/cannot (affect|drive) the verdict/i);
    expect(r.text).toContain('"kind": "browser_findings"');
  });

  it('says so when no environment or e2e command is configured', async () => {
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'VF-3' }, ctx);
    const r = await dispatch(unitTool, { action: 'brief', id: 'VF-3', stage: 'walkthrough', quiet: true }, ctx);
    expect(r.text).toMatch(/no environment with role sut/i);
    expect(r.text).toMatch(/no e2e command/i);
  });
});
