import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import { resolveMode } from '../../src/modes.js';
import { parseDeferred, renderPrBody } from '../../src/text/pr-body.js';
import { createState, type EvidenceRecord, type UnitState } from '../../src/store/state.js';
import type { Requirement } from '../../src/spec/requirement.js';

const at = '2026-09-04T00:00:00.000Z';
const requirement: Requirement = {
  title: 'Login redirect loop',
  url: 'https://t.example.test/ABC-1',
  body: 'Users loop forever.',
  criteria: [{ id: 'AC-1', text: 'No redirect loop' }, { id: 'AC-2', text: 'Lands on /home' }, { id: 'AC-3', text: 'Session kept' }],
};

function ev(kind: EvidenceRecord['kind'], payload: unknown, cycle = 0): EvidenceRecord {
  return { kind, cycle, recorded_at: at, payload };
}

function state(over: Partial<UnitState> = {}): UnitState {
  return {
    ...createState({ id: 'ABC-1', repo: 'local/x', tracked: true, source: { kind: 'ticket', ref: 'ABC-1', pinned: true }, mode: 'thorough', base_branch: 'main' }),
    kind: 'bug',
    evidence: [
      ev('self_critique', { findings: [{ severity: 'minor', text: 'naming', addressed: true }] }),
      ev('defect_repro', { test_location: 'test/login.test.ts', command: 'npm test', red_output: 'FAIL 1', green_output: 'PASS 1' }),
      ev('pii', { findings: [] }),
      ev('criteria_validation', { results: [{ criterion: 'AC-1', status: 'proven', proof: 'login.test.ts' }, { criterion: 'AC-2', status: 'unproven', proof: '' }] }),
      ev('waiver', { gate: 'pii_audit_clean', rationale: 'fixture emails only' }),
    ],
    ...over,
  };
}

describe('renderPrBody', () => {
  it('names every criterion in the scope ledger with proof and status', () => {
    const body = renderPrBody(state(), requirement, resolveMode('thorough', DEFAULTS));
    expect(body).toContain('# Login redirect loop');
    expect(body).toContain('## Scope ledger');
    for (const c of requirement.criteria) expect(body).toContain(c.id);
    expect(body).toMatch(/AC-1.*login\.test\.ts.*proven/);
    expect(body).toMatch(/AC-2.*unproven/);
    expect(body).toMatch(/AC-3.*not validated/);
  });

  it('summarizes evidence and waivers', () => {
    const body = renderPrBody(state(), requirement, resolveMode('thorough', DEFAULTS));
    expect(body).toContain('## Evidence');
    expect(body).toMatch(/self-critique: 1 finding/i);
    expect(body).toMatch(/defect repro.*red.*green/i);
    expect(body).toMatch(/personal-data audit: clean/i);
    expect(body).toContain('## Waivers');
    expect(body).toContain('pii_audit_clean');
    expect(body).toContain('fixture emails only');
  });

  it('lists deferred items from the plan under Not built', () => {
    const plan = '# Plan\n\n1. do it\n\n## Deferred\n\n- Rate limiting for the login endpoint\n- Telemetry dashboard\n\n## Other\n\n- ignored\n';
    expect(parseDeferred(plan)).toEqual(['Rate limiting for the login endpoint', 'Telemetry dashboard']);
    const body = renderPrBody(state(), requirement, resolveMode('thorough', DEFAULTS), { plan });
    expect(body).toContain('## Not built');
    expect(body).toContain('Rate limiting for the login endpoint');
    expect(body).not.toContain('- ignored');
    expect(renderPrBody(state(), requirement, resolveMode('thorough', DEFAULTS))).toMatch(/## Not built\n\n(none|nothing)/i);
  });

  it('lists demotions for sketch and none for thorough', () => {
    const thorough = renderPrBody(state(), requirement, resolveMode('thorough', DEFAULTS));
    expect(thorough).toContain('## Mode');
    expect(thorough).toMatch(/thorough/);
    expect(thorough).not.toContain('review_verdict_ship');
    expect(thorough).not.toContain('## Not proven');
    const sketch = renderPrBody(state({ mode: 'sketch' }), requirement, resolveMode('sketch', DEFAULTS));
    expect(sketch).toContain('review_verdict_ship → off');
    expect(sketch).toContain('walkthrough_done → off');
    expect(sketch).toContain('## Not proven');
  });

  it('opens a sketch body with the banner', () => {
    const body = renderPrBody(state({ mode: 'sketch' }), requirement, resolveMode('sketch', DEFAULTS));
    expect(body.split('\n')[0]).toMatch(/nothing reviewed/i);
    expect(body).toContain('## Not proven');
    expect(body).toMatch(/review, (challenge, )?verify/);
  });

  it('copes with no requirement and no evidence', () => {
    const bare = { ...createState({ id: 'X-1', repo: 'local/x', tracked: false, source: { kind: 'text', ref: null, pinned: true }, mode: 'thorough', base_branch: 'main' }) };
    const body = renderPrBody(bare, null, resolveMode('thorough', DEFAULTS));
    expect(body).toContain('# X-1');
    expect(body).toContain('## Scope ledger');
    expect(body).toMatch(/self-critique: not recorded/i);
  });
});
