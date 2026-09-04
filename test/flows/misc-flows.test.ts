import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../src/registry/tools.js';
import { stageEntry } from '../../src/registry/stages.js';
import { extractToolCalls } from '../../src/skills/inspect.js';
import { unitDirFor } from '../../src/store/units.js';
import { renderTicket } from '../../src/text/ticket.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

describe('botprs brief', () => {
  it('renders on empty config, takes no id, and says to skip when the codehost seat is unwired', async () => {
    expect(stageEntry('botprs')).toMatchObject({ standalone: true, takesNoId: true });
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    const r = await dispatch(unitTool, { action: 'brief', stage: 'botprs', quiet: true }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('# botprs');
    expect(r.text).toMatch(/skip and say so/i);
    expect(r.text).toMatch(/auto-merge/);
    expect(r.text).toMatch(/needs-review/);
    expect(r.text).toMatch(/hold/);
    expect(r.text).toMatch(/semver/i);
    expect(r.text).toMatch(/lockfile/i);
    expect(extractToolCalls(r.text)).toEqual(expect.arrayContaining([{ tool: 'digest', action: 'write' }]));
  });

  it('names the codehost tools when the seat is wired', async () => {
    const repo = makeRepo({ 'README.md': 'x', '.harness.yaml': 'schema: 1\nseats:\n  codehost:\n    read_threads: [mcp__host__list_prs]\n    open_pr: [mcp__host__open]\n' });
    const ctx = makeCtx({ cwd: repo });
    const r = await dispatch(unitTool, { action: 'brief', stage: 'botprs', quiet: true }, ctx);
    expect(r.text).toContain('mcp__host__list_prs');
    expect(r.text).not.toMatch(/skip and say so/i);
  });
});

describe('renderTicket', () => {
  it('numbers criteria AC-n and lays out title, context, and out of scope', () => {
    const md = renderTicket({ title: 'Export orders as CSV', context: 'Support asked for it twice.', criteria: ['Button on the orders page', 'Download includes every visible column'], out_of_scope: ['Excel format'] });
    expect(md.startsWith('# Export orders as CSV\n')).toBe(true);
    expect(md).toContain('## Context');
    expect(md).toContain('Support asked for it twice.');
    expect(md).toContain('- AC-1: Button on the orders page');
    expect(md).toContain('- AC-2: Download includes every visible column');
    expect(md).toContain('## Out of scope');
    expect(md).toContain('- Excel format');
    const bare = renderTicket({ title: 'T', context: '', criteria: [], out_of_scope: [] });
    expect(bare).toMatch(/no acceptance criteria yet/i);
    expect(bare).toMatch(/nothing excluded yet/i);
  });
});

describe('draft brief', () => {
  it('renders on empty config with the ticket template and files-after-approval rule, naming no create tool when unwired', async () => {
    expect(stageEntry('draft')).toMatchObject({ standalone: true, takesNoId: true });
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    const r = await dispatch(unitTool, { action: 'brief', stage: 'draft', quiet: true }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('# draft');
    expect(r.text).toContain('AC-1');
    expect(r.text).toMatch(/only after (the user'?s )?approval/i);
    expect(r.text).toMatch(/tracker seat.*unwired|no create tool/i);
    expect(r.text).toContain('drafts/ticket.md');
  });

  it('writes drafts/ticket.md for a named unit and names the tracker create tool when wired', async () => {
    const repo = makeRepo({ 'README.md': 'x', '.harness.yaml': 'schema: 1\nseats:\n  tracker:\n    create: [mcp__tracker__create_issue]\n' });
    const ctx = makeCtx({ cwd: repo });
    await dispatch(unitTool, { action: 'start', source: 'text', id: 'DR-1', text: 'Add an export button so support stops asking.' }, ctx);
    const r = await dispatch(unitTool, { action: 'brief', id: 'DR-1', stage: 'draft', quiet: true }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('mcp__tracker__create_issue');
    const draft = path.join(unitDirFor(ctx, 'DR-1'), 'drafts', 'ticket.md');
    expect(fs.existsSync(draft)).toBe(true);
    const text = fs.readFileSync(draft, 'utf8');
    expect(text).toContain('Add an export button so support stops asking.');
    expect(text).toMatch(/AC-1/);
  });
});
