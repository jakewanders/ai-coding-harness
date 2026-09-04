import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { triage } from '../../src/flows/aftercare.js';
import { dispatch } from '../../src/registry/tools.js';
import { stageEntry } from '../../src/registry/stages.js';
import { readState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { renderReplies } from '../../src/text/replies.js';
import { pullreqTool } from '../../src/tools/pullreq.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

const threads = [
  { id: 't1', author: 'reviewer', body: 'nit: rename this helper', path: 'src/a.ts', line: 3, resolved: false },
  { id: 't2', author: 'reviewer', body: 'This throws on empty input', path: 'src/a.ts', line: 10, resolved: false },
  { id: 't3', author: 'other', body: 'Docs mention the old flag', path: 'README.md', line: 1, resolved: false },
  { id: 't4', author: 'reviewer', body: 'Looks good', resolved: true },
];

describe('inspect', () => {
  it('takes no id, starts a pr-<number> unit from a pr source, and renders a read-only brief', async () => {
    expect(stageEntry('inspect')).toMatchObject({ standalone: true, takesNoId: true });
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    const start = await dispatch(unitTool, { action: 'start', source: 'pr', ref: 'https://example.test/o/n/pull/42' }, ctx);
    expect(start.envelope.ok).toBe(true);
    expect(start.envelope.data).toMatchObject({ id: 'pr-42', tracked: false });
    expect(readState(unitDirFor(ctx, 'pr-42')).source).toEqual({ kind: 'pr', ref: 'https://example.test/o/n/pull/42', pinned: false });
    const hash = await dispatch(unitTool, { action: 'start', source: 'pr', ref: '#7' }, ctx);
    expect(hash.envelope.data).toMatchObject({ id: 'pr-7' });
    const r = await dispatch(unitTool, { action: 'brief', id: 'pr-42', stage: 'inspect', quiet: true }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('# inspect');
    expect(r.text).toContain('read-only');
    expect(r.text).toContain('pr-42');
    expect(r.text).toMatch(/review_column/);
    expect(r.text).toMatch(/only evidence kind/i);
    expect(r.text).toMatch(/evidence synthesize/);
    expect(r.text).not.toMatch(/vcs commit/);
    const noUnit = await dispatch(unitTool, { action: 'brief', stage: 'inspect', quiet: true }, ctx);
    expect(noUnit.envelope.ok).toBe(true);
    expect(noUnit.text).toMatch(/unit start/);
  });
});

describe('renderReplies', () => {
  it('drafts one reply per thread grouped by path with the chosen decision', () => {
    const md = renderReplies(threads.filter((t) => !t.resolved), { t1: { action: 'fix', text: 'Renamed to formatMoney.' }, t2: { action: 'fix', text: 'Guarded the empty case; test added.' }, t3: { action: 'reply', text: 'The flag is still supported for one release.' } });
    expect(md.indexOf('## README.md')).toBeLessThan(md.indexOf('## src/a.ts'));
    expect(md).toContain('### t1 (src/a.ts:3)');
    expect(md).toContain('> nit: rename this helper');
    expect(md).toContain('Renamed to formatMoney.');
    expect(md).toMatch(/t2.*\n[\s\S]*fix/);
    expect(md).toContain('The flag is still supported for one release.');
    expect(md).toMatch(/resolve on the host: t1, t2/i);
    expect(renderReplies([], {})).toMatch(/no open threads/i);
  });
});

describe('respond', () => {
  it('groups threads by file, instructs one batched commit per round, writes drafts/replies.md and lists threads to resolve', async () => {
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'RS-1' }, ctx);
    await dispatch(pullreqTool, { action: 'record', id: 'RS-1', url: 'https://example.test/o/n/pull/5', number: 5, base: 'main', head: 'RS-1' }, ctx);
    await dispatch(pullreqTool, { action: 'threads', id: 'RS-1', threads }, ctx);
    const r = await dispatch(unitTool, { action: 'brief', id: 'RS-1', stage: 'respond', quiet: true }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('# respond');
    expect(r.text.indexOf('### README.md')).toBeLessThan(r.text.indexOf('### src/a.ts'));
    expect(r.text).toContain('t1');
    expect(r.text).toContain('t2');
    expect(r.text).toContain('t3');
    expect(r.text).not.toMatch(/t4.*Looks good/);
    expect(r.text).toMatch(/one batched commit/i);
    expect(r.text).toMatch(/resolve.*on the host/i);
    expect(r.text).toContain('drafts/replies.md');
    const draft = path.join(unitDirFor(ctx, 'RS-1'), 'drafts', 'replies.md');
    expect(fs.existsSync(draft)).toBe(true);
    expect(fs.readFileSync(draft, 'utf8')).toContain('### t2 (src/a.ts:10)');
  });

  it('says when there is no PR or no open threads', async () => {
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'RS-2' }, ctx);
    const noPr = await dispatch(unitTool, { action: 'brief', id: 'RS-2', stage: 'respond', quiet: true }, ctx);
    expect(noPr.text).toMatch(/no pull request recorded/i);
    await dispatch(pullreqTool, { action: 'record', id: 'RS-2', url: 'https://example.test/o/n/pull/6', base: 'main', head: 'RS-2' }, ctx);
    const none = await dispatch(unitTool, { action: 'brief', id: 'RS-2', stage: 'respond', quiet: true }, ctx);
    expect(none.text).toMatch(/no open threads/i);
  });
});

describe('aftercare', () => {
  it('classifies follow-up comments into fix now, new ticket and reply only', () => {
    const buckets = triage([
      { id: 'a1', author: 'u', body: 'After this shipped the export button crashes on Safari', resolved: false },
      { id: 'a2', author: 'u', body: 'Could you also add an Excel export as a follow-up?', resolved: false },
      { id: 'a3', author: 'u', body: 'Thanks, why did you pick streaming here?', resolved: false },
      { id: 'a4', author: 'u', body: 'old', resolved: true },
    ]);
    expect(buckets.fix_now.map((t) => t.id)).toEqual(['a1']);
    expect(buckets.new_ticket.map((t) => t.id)).toEqual(['a2']);
    expect(buckets.reply_only.map((t) => t.id)).toEqual(['a3']);
  });

  it('renders all three buckets with drafted text and saves drafts/aftercare.md', async () => {
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'AF-1' }, ctx);
    await dispatch(pullreqTool, { action: 'record', id: 'AF-1', url: 'https://example.test/o/n/pull/9', number: 9, base: 'main', head: 'AF-1' }, ctx);
    await dispatch(pullreqTool, { action: 'threads', id: 'AF-1', threads: [
      { id: 'a1', author: 'u', body: 'The export button crashes on Safari since this landed', resolved: false },
      { id: 'a2', author: 'u', body: 'Could you also add an Excel export? nice to have', resolved: false },
      { id: 'a3', author: 'u', body: 'Why streaming here?', resolved: false },
    ] }, ctx);
    const r = await dispatch(unitTool, { action: 'brief', id: 'AF-1', stage: 'aftercare', quiet: true }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('# aftercare');
    for (const heading of ['Fix now', 'New ticket', 'Reply only']) expect(r.text).toContain(heading);
    expect(r.text).toContain('a1');
    expect(r.text).toContain('a2');
    expect(r.text).toContain('a3');
    expect(r.text).toContain('drafts/aftercare.md');
    const draft = fs.readFileSync(path.join(unitDirFor(ctx, 'AF-1'), 'drafts', 'aftercare.md'), 'utf8');
    expect(draft).toMatch(/fix now/i);
    expect(draft).toMatch(/new ticket/i);
    expect(draft).toMatch(/reply only/i);
    expect(draft).toContain('a2');
  });
});
