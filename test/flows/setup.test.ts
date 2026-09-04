import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectShipped, scanFiles } from '../../src/lint/scan.js';
import { dispatch } from '../../src/registry/tools.js';
import { stageEntry } from '../../src/registry/stages.js';
import { mapToolsToSeats } from '../../src/setup/seat-heuristics.js';
import { systemTool } from '../../src/tools/system.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx, repoRoot } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';
import { ALLOW_MARKER, DENY } from '../lint/denylist.js';

const TOOLS = [
  'mcp__jira__get_issue',
  'mcp__linear__create_issue',
  'mcp__github__create_pull_request',
  'mcp__github__get_pr_review_threads',
  'mcp__confluence__search_pages',
  'mcp__figma__get_file',
  'mcp__slack__post_message',
  'mcp__coderabbit__get_review_status',
  'mcp__weather__forecast',
  'Bash',
  'Read',
];

describe('mapToolsToSeats', () => {
  it('maps tool names to seats by product and generic words and leaves unknowns unmapped', () => {
    const seats = mapToolsToSeats(TOOLS);
    expect(seats.tracker).toEqual(['mcp__jira__get_issue', 'mcp__linear__create_issue']);
    expect(seats.codehost).toEqual(['mcp__github__create_pull_request', 'mcp__github__get_pr_review_threads']);
    expect(seats.docs).toEqual(['mcp__confluence__search_pages']);
    expect(seats.design).toEqual(['mcp__figma__get_file']);
    expect(seats.chat).toEqual(['mcp__slack__post_message']);
    expect(seats.reviewbot).toEqual(['mcp__coderabbit__get_review_status']);
    const all = Object.values(seats).flat();
    expect(all).not.toContain('mcp__weather__forecast');
    expect(all).not.toContain('Bash');
    expect(all).not.toContain('Read');
  });

  it('uses generic words when no product name is present, and never assigns one tool twice', () => {
    const seats = mapToolsToSeats(['tracker__ticket_get', 'host__pull_request_open', 'wiki__page_search', 'design__frame_export', 'team__chat_message_post', 'bot__review_status']);
    expect(seats.tracker).toEqual(['tracker__ticket_get']);
    expect(seats.codehost).toEqual(['host__pull_request_open']);
    expect(seats.docs).toEqual(['wiki__page_search']);
    expect(seats.design).toEqual(['design__frame_export']);
    expect(seats.chat).toEqual(['team__chat_message_post']);
    expect(seats.reviewbot).toEqual(['bot__review_status']);
    const all = Object.values(seats).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(mapToolsToSeats([])).toEqual({ tracker: [], codehost: [], docs: [], design: [], chat: [], reviewbot: [] });
  });
});

describe('system seats', () => {
  it('maps the pasted tool names and renders a seats YAML fragment', async () => {
    const r = await dispatch(systemTool, { action: 'seats', tools: TOOLS }, makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) }));
    expect(r.envelope.ok).toBe(true);
    const data = r.envelope.data as { seats: Record<string, string[]>; unmapped: string[]; yaml: string };
    expect(data.seats.tracker).toEqual(['mcp__jira__get_issue', 'mcp__linear__create_issue']);
    expect(data.unmapped).toEqual(['mcp__weather__forecast', 'Bash', 'Read']);
    expect(data.yaml).toContain('seats:');
    expect(data.yaml).toContain('mcp__slack__post_message');
    expect(r.text).toContain('unmapped');
  });
});

describe('setup brief', () => {
  it('walks doctor, seats, questions, proposal and ends with the confirmation instruction', async () => {
    expect(stageEntry('setup')).toMatchObject({ standalone: true, takesNoId: true });
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) });
    const r = await dispatch(unitTool, { action: 'brief', stage: 'setup', quiet: true }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.text).toContain('# setup');
    expect(r.text).toContain('system doctor');
    expect(r.text).toContain('system seats');
    expect(r.text).toMatch(/reviewbot/);
    expect(r.text).toMatch(/kits/);
    expect(r.text).toMatch(/environments/);
    expect(r.text).toContain('system config');
    const body = r.text.split('\n```json\n')[0]!.replace(/\n+$/, '');
    const lastParagraph = body.split('\n').filter((l) => l.trim()).at(-1)!;
    expect(lastParagraph).toMatch(/only after the user confirms/i);
    expect(body.indexOf('system doctor')).toBeLessThan(body.indexOf('system seats'));
    expect(body.indexOf('system seats')).toBeLessThan(body.indexOf('"mode": "write"'));
  });
});

describe('vocabulary lint', () => {
  it('stays at zero hits with the seat heuristics allow-marked', () => {
    expect(scanFiles(collectShipped(repoRoot), DENY, ALLOW_MARKER)).toEqual([]);
    const src = fs.readFileSync(path.join(repoRoot, 'src', 'setup', 'seat-heuristics.ts'), 'utf8');
    expect(src.split('\n').filter((l) => l.includes(ALLOW_MARKER)).length).toBeGreaterThanOrEqual(6);
  });
});
