import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { envelope } from '../../src/contracts/envelope.js';
import { defineTool, describeTool, dispatch, toolInputSchema, result } from '../../src/registry/tools.js';
import { systemTool } from '../../src/tools/system.js';
import { ensureVault } from '../../src/store/vault.js';
import { VERSION } from '../../src/index.js';
import { makeCtx } from '../helpers/ctx.js';

const fake = defineTool({
  name: 'fake',
  description: 'A fake tool for tests.',
  actions: {
    greet: {
      describe: 'Say hello.',
      schema: z.object({ name: z.string(), loud: z.boolean().optional() }),
      handler: async (input, ctx) => result(`hi ${input.name}`, envelope(true, 'greeted', { name: input.name, at: ctx.now().toISOString() })),
    },
    count: {
      describe: 'Count things.',
      schema: z.object({ n: z.number().int().min(1) }),
      handler: async (input) => result(`${input.n}`, envelope(true, 'counted', { n: input.n })),
    },
  },
});

describe('describeTool', () => {
  it('appends the computed action list', () => {
    expect(describeTool(fake)).toBe('A fake tool for tests. Actions: greet, count.');
  });
});

describe('toolInputSchema', () => {
  it('requires action as an enum and merges every action parameter as optional', () => {
    const s = toolInputSchema(fake) as { type: string; required: string[]; properties: Record<string, unknown> };
    expect(s.type).toBe('object');
    expect(s.required).toEqual(['action']);
    expect((s.properties.action as { enum: string[] }).enum).toEqual(['greet', 'count']);
    expect(Object.keys(s.properties).sort()).toEqual(['action', 'loud', 'n', 'name']);
  });
});

describe('dispatch', () => {
  it('rejects an unknown action and names the valid ones', async () => {
    const r = await dispatch(fake, { action: 'nope' }, makeCtx());
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.summary).toContain('nope');
    expect(r.envelope.summary).toContain('greet');
    expect(r.envelope.summary).toContain('count');
    expect(r.text).toContain('```json');
  });

  it('rejects a missing action the same way', async () => {
    const r = await dispatch(fake, {}, makeCtx());
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.summary).toMatch(/greet, count/);
  });

  it('rejects invalid params with the offending path', async () => {
    const r = await dispatch(fake, { action: 'count', n: 0 }, makeCtx());
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.summary).toContain('n');
    const r2 = await dispatch(fake, { action: 'greet' }, makeCtx());
    expect(r2.envelope.ok).toBe(false);
    expect(r2.envelope.summary).toContain('name');
  });

  it('runs the handler with the validated input and renders the envelope', async () => {
    const r = await dispatch(fake, { action: 'greet', name: 'jo' }, makeCtx());
    expect(r.envelope).toMatchObject({ ok: true, summary: 'greeted', data: { name: 'jo' } });
    expect(r.text.startsWith('hi jo\n\n```json\n')).toBe(true);
    expect(JSON.parse(/```json\n([\s\S]*)\n```$/.exec(r.text)![1]!)).toEqual(r.envelope);
  });

  it('turns a throwing handler into ok: false instead of propagating', async () => {
    const boom = defineTool({
      name: 'boom',
      description: 'Throws.',
      actions: { go: { describe: 'go', schema: z.object({}), handler: async () => { throw new Error('kaboom'); } } },
    });
    const r = await dispatch(boom, { action: 'go' }, makeCtx());
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.summary).toContain('kaboom');
  });
});

describe('system tool', () => {
  it('version returns the package version', async () => {
    const r = await dispatch(systemTool, { action: 'version' }, makeCtx());
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toEqual({ version: VERSION });
    expect(r.text).toContain(VERSION);
  });

  it('health reports the vault and node version', async () => {
    const ctx = makeCtx();
    const missing = await dispatch(systemTool, { action: 'health' }, ctx);
    expect(missing.envelope.data).toEqual({ vault: 'missing', node: process.version });
    ensureVault(ctx.vault);
    const ok = await dispatch(systemTool, { action: 'health' }, ctx);
    expect(ok.envelope.data).toEqual({ vault: 'ok', node: process.version });
  });
});
