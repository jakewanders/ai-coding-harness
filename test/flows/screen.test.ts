import { describe, expect, it } from 'vitest';
import { EVIDENCE_KINDS } from '../../src/evidence/kinds.js';
import { dispatch } from '../../src/registry/tools.js';
import { consensus, type ScreenVerdict } from '../../src/review/consensus.js';
import { extractToolCalls } from '../../src/skills/inspect.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

const v = (dimension: ScreenVerdict['dimension'], model: ScreenVerdict['model'], verdict: ScreenVerdict['verdict'], reasons: string[] = []): ScreenVerdict => ({ dimension, model, verdict, reasons });

describe('screen_verdict schema', () => {
  it('accepts the dimension/model/verdict/reasons shape and rejects the old one', () => {
    expect(EVIDENCE_KINDS.screen_verdict.schema.safeParse(v('technical', 'primary', 'valid', ['clear'])).success).toBe(true);
    expect(EVIDENCE_KINDS.screen_verdict.schema.safeParse(v('product', 'second', 'unclear')).success).toBe(true);
    expect(EVIDENCE_KINDS.screen_verdict.schema.safeParse({ dimension: 'technical', reviewer: 'primary', verdict: 'valid', rationale: 'x' }).success).toBe(false);
    expect(EVIDENCE_KINDS.screen_verdict.schema.safeParse({ dimension: 'technical', model: 'primary', verdict: 'needs_info', reasons: [] }).success).toBe(false);
  });
});

describe('consensus', () => {
  const cases: Array<[string, ScreenVerdict[], { verdict: string; agreement: number; dissent: string[] }]> = [
    ['unanimous valid', [v('technical', 'primary', 'valid'), v('technical', 'second', 'valid'), v('product', 'primary', 'valid'), v('product', 'second', 'valid')], { verdict: 'valid', agreement: 1, dissent: [] }],
    ['unanimous invalid', [v('technical', 'primary', 'invalid', ['no repro']), v('technical', 'second', 'invalid'), v('product', 'primary', 'invalid'), v('product', 'second', 'invalid')], { verdict: 'invalid', agreement: 1, dissent: [] }],
    ['a valid and an invalid disagree', [v('technical', 'primary', 'valid'), v('technical', 'second', 'invalid', ['cannot be built as described']), v('product', 'primary', 'valid'), v('product', 'second', 'valid')], { verdict: 'unclear', agreement: 0.75, dissent: ['technical/second: invalid — cannot be built as described'] }],
    ['unclear anywhere makes it unclear', [v('technical', 'primary', 'valid'), v('technical', 'second', 'valid'), v('product', 'primary', 'unclear', ['who is the user?']), v('product', 'second', 'valid')], { verdict: 'unclear', agreement: 0.75, dissent: ['product/primary: unclear — who is the user?'] }],
    ['missing second-model records are noted', [v('technical', 'primary', 'valid'), v('product', 'primary', 'valid')], { verdict: 'valid', agreement: 1, dissent: ['technical/second: missing', 'product/second: missing'] }],
    ['no records at all', [], { verdict: 'unclear', agreement: 0, dissent: ['technical/primary: missing', 'technical/second: missing', 'product/primary: missing', 'product/second: missing'] }],
  ];
  for (const [name, records, expected] of cases) {
    it(name, () => {
      expect(consensus(records)).toEqual(expected);
    });
  }

  it('uses the latest record per dimension and model', () => {
    const r = consensus([v('technical', 'primary', 'invalid'), v('technical', 'primary', 'valid'), v('technical', 'second', 'valid'), v('product', 'primary', 'valid'), v('product', 'second', 'valid')]);
    expect(r.verdict).toBe('valid');
  });
});

describe('screen brief', () => {
  it('lists the four structured verdict calls, the second-model route, the consensus step and the status hint', async () => {
    const repo = makeRepo({ 'README.md': 'x', '.harness.yaml': 'schema: 1\ntickets:\n  - pattern: "^SC-\\\\d+$"\n    status_hints:\n      define: "In Analysis"\n' });
    const ctx = makeCtx({ cwd: repo });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'SC-1' }, ctx);
    const r = await dispatch(unitTool, { action: 'brief', id: 'SC-1', stage: 'screen', quiet: true }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('# screen');
    const calls = extractToolCalls(r.text);
    const records = calls.filter((c) => c.tool === 'evidence' && c.action === 'record');
    expect(records).toHaveLength(4);
    for (const combo of ['"dimension": "technical", "model": "primary"', '"dimension": "technical", "model": "second"', '"dimension": "product", "model": "primary"', '"dimension": "product", "model": "second"']) {
      expect(r.text).toContain(combo);
    }
    expect(r.text).toMatch(/second (call|model|framing)/i);
    expect(r.text).toMatch(/consensus/i);
    expect(r.text).toContain('In Analysis');
    expect(r.text).toContain('SC-1');
  });

  it('says when no status hint is configured', async () => {
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'SC-2' }, ctx);
    const r = await dispatch(unitTool, { action: 'brief', id: 'SC-2', stage: 'screen', quiet: true }, ctx);
    expect(r.text).toMatch(/no status hint/i);
  });
});
