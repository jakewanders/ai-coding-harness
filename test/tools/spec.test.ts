import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../src/registry/tools.js';
import { parseRequirement, renderRequirement } from '../../src/spec/requirement.js';
import { readState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { specTool } from '../../src/tools/spec.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

async function unitCtx(id = 'ABC-1') {
  const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id }, ctx);
  return ctx;
}

describe('parseRequirement / renderRequirement', () => {
  it('round-trips title, url, body and criteria', () => {
    const md = renderRequirement({ title: 'Login loop', url: 'https://t.example.test/ABC-1', body: 'Users loop.\n\nSecond para.', criteria: [{ id: 'AC-1', text: 'no loop' }, { id: 'AC-2', text: 'lands on /home' }] });
    expect(md.startsWith('# Login loop\n')).toBe(true);
    expect(parseRequirement(md)).toEqual({ title: 'Login loop', url: 'https://t.example.test/ABC-1', body: 'Users loop.\n\nSecond para.', criteria: [{ id: 'AC-1', text: 'no loop' }, { id: 'AC-2', text: 'lands on /home' }] });
  });

  it('tolerates a missing url and no criteria section', () => {
    expect(parseRequirement('# T\n\nbody only\n')).toEqual({ title: 'T', url: null, body: 'body only', criteria: [] });
    expect(parseRequirement('')).toEqual({ title: '', url: null, body: '', criteria: [] });
  });
});

describe('spec record', () => {
  it('writes requirement.md and infers a bug from the wording', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(specTool, { action: 'record', id: 'ABC-1', title: 'Login redirect is broken', body: 'Users loop forever.', url: 'https://t.example.test/ABC-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toMatchObject({ id: 'ABC-1', kind: 'bug' });
    const md = fs.readFileSync(path.join(unitDirFor(ctx, 'ABC-1'), 'requirement.md'), 'utf8');
    expect(md).toContain('# Login redirect is broken');
    expect(md).toContain('https://t.example.test/ABC-1');
    expect(md).toContain('Users loop forever.');
    expect(readState(unitDirFor(ctx, 'ABC-1')).kind).toBe('bug');
  });

  it('lets an explicit kind win and defaults to feature otherwise', async () => {
    const ctx = await unitCtx();
    await dispatch(specTool, { action: 'record', id: 'ABC-1', title: 'Crash on save', body: 'x', kind: 'chore' }, ctx);
    expect(readState(unitDirFor(ctx, 'ABC-1')).kind).toBe('chore');
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'ABC-2' }, ctx);
    await dispatch(specTool, { action: 'record', id: 'ABC-2', title: 'Add export button', body: 'Nice to have.' }, ctx);
    expect(readState(unitDirFor(ctx, 'ABC-2')).kind).toBe('feature');
  });

  it('fails for an unknown unit', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(specTool, { action: 'record', id: 'NOPE-1', title: 't', body: 'b' }, ctx);
    expect(r.envelope.ok).toBe(false);
  });
});

describe('spec pin', () => {
  it('writes source.md and marks the source pinned', async () => {
    const ctx = await unitCtx();
    expect(readState(unitDirFor(ctx, 'ABC-1')).source.pinned).toBe(false);
    const r = await dispatch(specTool, { action: 'pin', id: 'ABC-1', text: 'verbatim ticket text', ref: 'ABC-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(fs.readFileSync(path.join(unitDirFor(ctx, 'ABC-1'), 'source.md'), 'utf8')).toBe('verbatim ticket text');
    expect(readState(unitDirFor(ctx, 'ABC-1')).source).toEqual({ kind: 'ticket', ref: 'ABC-1', pinned: true });
  });
});

describe('spec criteria', () => {
  it('numbers criteria, appends the section, and renumbers on re-set', async () => {
    const ctx = await unitCtx();
    await dispec(ctx);
    const first = await dispatch(specTool, { action: 'criteria', id: 'ABC-1', set: ['No redirect loop', 'Lands on /home'] }, ctx);
    expect(first.envelope.ok).toBe(true);
    expect((first.envelope.data as { criteria: unknown }).criteria).toEqual([{ id: 'AC-1', text: 'No redirect loop' }, { id: 'AC-2', text: 'Lands on /home' }]);
    const md = fs.readFileSync(path.join(unitDirFor(ctx, 'ABC-1'), 'requirement.md'), 'utf8');
    expect(md).toContain('## Acceptance criteria');
    expect(md).toContain('- AC-1: No redirect loop');
    expect(md).toContain('# Login loop');
    const second = await dispatch(specTool, { action: 'criteria', id: 'ABC-1', set: ['Lands on /home', 'Session kept', 'Logged'] }, ctx);
    expect((second.envelope.data as { criteria: unknown }).criteria).toEqual([{ id: 'AC-1', text: 'Lands on /home' }, { id: 'AC-2', text: 'Session kept' }, { id: 'AC-3', text: 'Logged' }]);
    const md2 = fs.readFileSync(path.join(unitDirFor(ctx, 'ABC-1'), 'requirement.md'), 'utf8');
    expect(md2.match(/## Acceptance criteria/g)).toHaveLength(1);
    expect(md2).not.toContain('No redirect loop');
    const read = await dispatch(specTool, { action: 'criteria', id: 'ABC-1' }, ctx);
    expect((read.envelope.data as { criteria: unknown[] }).criteria).toHaveLength(3);
  });

  it('creates a minimal requirement when none was recorded yet', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(specTool, { action: 'criteria', id: 'ABC-1', set: ['works'] }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(parseRequirement(fs.readFileSync(path.join(unitDirFor(ctx, 'ABC-1'), 'requirement.md'), 'utf8')).criteria).toEqual([{ id: 'AC-1', text: 'works' }]);
  });
});

describe('spec related and get', () => {
  it('round-trips record, criteria and related through get', async () => {
    const ctx = await unitCtx();
    await dispec(ctx);
    await dispatch(specTool, { action: 'criteria', id: 'ABC-1', set: ['No redirect loop'] }, ctx);
    const items = [
      { kind: 'parent', ref: 'ABC-0', title: 'Auth epic' },
      { kind: 'pr', ref: '#41', note: 'earlier attempt' },
      { kind: 'linked', ref: 'https://docs.example.test/auth' },
    ];
    const rel = await dispatch(specTool, { action: 'related', id: 'ABC-1', items }, ctx);
    expect(rel.envelope.ok).toBe(true);
    expect(fs.existsSync(path.join(unitDirFor(ctx, 'ABC-1'), 'related.md'))).toBe(true);
    const got = await dispatch(specTool, { action: 'get', id: 'ABC-1' }, ctx);
    expect(got.envelope.ok).toBe(true);
    expect(got.envelope.data).toEqual({
      id: 'ABC-1',
      kind: 'bug',
      source: { kind: 'ticket', ref: 'ABC-1', pinned: false, text: null },
      requirement: { title: 'Login loop', url: 'https://t.example.test/ABC-1', body: 'Users loop forever after a broken redirect.', criteria: [{ id: 'AC-1', text: 'No redirect loop' }] },
      related: [
        { kind: 'parent', ref: 'ABC-0', title: 'Auth epic', note: null },
        { kind: 'pr', ref: '#41', title: null, note: 'earlier attempt' },
        { kind: 'linked', ref: 'https://docs.example.test/auth', title: null, note: null },
      ],
    });
    expect(got.text).toContain('AC-1');
    expect(got.text).toContain('Auth epic');
  });

  it('get on a bare unit reports nulls and empties', async () => {
    const ctx = await unitCtx();
    const got = await dispatch(specTool, { action: 'get', id: 'ABC-1' }, ctx);
    expect(got.envelope.data).toMatchObject({ requirement: null, related: [], source: { pinned: false, text: null } });
  });
});

async function dispec(ctx: ReturnType<typeof makeCtx>) {
  await dispatch(specTool, { action: 'record', id: 'ABC-1', title: 'Login loop', body: 'Users loop forever after a broken redirect.', url: 'https://t.example.test/ABC-1' }, ctx);
}
