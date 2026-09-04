import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { dispatch } from '../src/registry/tools.js';
import { unitTool } from '../src/tools/unit.js';
import { makeCtx } from './helpers/ctx.js';
import { makeRepo } from './helpers/git.js';

function headerOf(text: string): Record<string, unknown> {
  return parseYaml(/```yaml\n([\s\S]*?)\n```/.exec(text)![1]!) as Record<string, unknown>;
}

describe('run modes end to end', () => {
  it('unit start rejects an unknown mode and names the known ones', async () => {
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    const r = await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'MD-1', mode: 'turbo-ish' }, ctx);
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.summary).toContain('turbo-ish');
    for (const m of ['thorough', 'express', 'sketch']) expect(r.envelope.summary).toContain(m);
  });

  it('accepts a custom mode from config, inheriting its parent demotions into the brief', async () => {
    const repo = makeRepo({ 'README.md': 'x', '.harness.yaml': 'schema: 1\nmodes:\n  fast:\n    extends: express\n    demote:\n      pii_audit_clean: warn\n' });
    const ctx = makeCtx({ cwd: repo });
    const start = await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'MD-2', mode: 'fast' }, ctx);
    expect(start.envelope.ok).toBe(true);
    const bad = await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'MD-3', mode: 'nope' }, ctx);
    expect(bad.envelope.summary).toContain('fast');
    const brief = await dispatch(unitTool, { action: 'brief', id: 'MD-2', stage: 'commit', quiet: true }, ctx);
    expect(headerOf(brief.text).mode).toBe('fast');
    expect(brief.text).toContain('## Mode');
    expect(brief.text).toContain('fast');
    expect(brief.text).toContain('extends express');
    expect(brief.text).toContain('reach_audit_recorded → warn');
    expect(brief.text).toContain('pii_audit_clean → warn');
  });

  it('the express brief lists its two demotions and points at the mode notes', async () => {
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'MD-4', mode: 'express' }, ctx);
    const brief = await dispatch(unitTool, { action: 'brief', id: 'MD-4', stage: 'build', quiet: true }, ctx);
    expect(brief.text).toContain('## Mode');
    expect(brief.text).toContain('reach_audit_recorded → warn');
    expect(brief.text).toContain('counterweight_consulted → warn');
    expect(brief.text).toContain('@root/skills/build/modes/express.md');
    expect(brief.text).toMatch(/verify runs after publish/i);
    const pilot = await dispatch(unitTool, { action: 'brief', id: 'MD-4', stage: 'pilot', quiet: true }, ctx);
    expect(pilot.text).toMatch(/merged dispatch|one dispatch/i);
  });

  it('the sketch build brief says nothing will review the diff and lists skipped stages', async () => {
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'MD-5', mode: 'sketch' }, ctx);
    const brief = await dispatch(unitTool, { action: 'brief', id: 'MD-5', stage: 'build', quiet: true }, ctx);
    expect(brief.text).toMatch(/nothing reviewed/i);
    expect(brief.text).toMatch(/skipped stages: review, challenge, verify/i);
    expect(brief.text).toContain('@root/skills/build/modes/sketch.md');
    const thorough = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'MD-6' }, thorough);
    const plain = await dispatch(unitTool, { action: 'brief', id: 'MD-6', stage: 'build', quiet: true }, thorough);
    expect(plain.text).toContain('## Mode');
    expect(plain.text).toMatch(/thorough/);
    expect(plain.text).not.toContain('→ warn');
    expect(plain.text).not.toContain('/modes/');
    expect(fs.existsSync(path.join(ctx.root, 'skills', 'build', 'modes', 'sketch.md'))).toBe(true);
  });
});
