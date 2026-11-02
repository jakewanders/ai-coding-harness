import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  BRIEF_CONTRACT,
  HeaderSchema,
  ROLE_NAMES,
  renderHeader,
  type BriefHeader,
} from '../../src/contracts/header.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function sampleHeader(): BriefHeader {
  return {
    contract: BRIEF_CONTRACT,
    unit: 'ABC-123',
    mode: 'thorough',
    stage: 'build',
    repo: 'example.test/owner/name',
    worktree: '~/code/name-ABC-123',
    base_branch: 'main',
    root: '/abs/plugin/root',
    roles: {
      tracker: ['mcp__tracker__get_issue'],
      codehost: 'unwired',
      docs: 'unwired',
      design: 'unwired',
      chat: 'unwired',
      reviewbot: 'unwired',
    },
    capabilities: { isolation: 'worktree', browser_ui: true },
    gates: [{ id: 'self_critique_recorded', severity: 'block', status: 'pass' }],
    docs: ['/abs/path/to/convention.md'],
    config_errors: [{ file: '~/.harness/config.yaml', path: 'modes.default', line: 4, message: 'unknown mode' }],
  };
}

describe('HeaderSchema', () => {
  it('accepts a complete header', () => {
    expect(HeaderSchema.parse(sampleHeader())).toEqual(sampleHeader());
  });

  it('rejects a header missing contract', () => {
    const { contract: _drop, ...rest } = sampleHeader();
    expect(() => HeaderSchema.parse(rest)).toThrow();
  });

  it('rejects a wrong contract string', () => {
    expect(() => HeaderSchema.parse({ ...sampleHeader(), contract: 'harness-brief/2' })).toThrow();
  });

  it('rejects an unknown role name and a bad gate status', () => {
    const h = sampleHeader();
    expect(() => HeaderSchema.parse({ ...h, roles: { ...h.roles, butler: 'unwired' } })).toThrow();
    expect(() => HeaderSchema.parse({ ...h, gates: [{ id: 'x', severity: 'block', status: 'maybe' }] })).toThrow();
  });

  it('lists the six roles in spec order', () => {
    expect(ROLE_NAMES).toEqual(['tracker', 'codehost', 'docs', 'design', 'chat', 'reviewbot']);
  });
});

describe('renderHeader', () => {
  it('starts with the yaml fence and the contract key, and parses back', () => {
    const out = renderHeader(sampleHeader());
    expect(out.startsWith('```yaml\ncontract: harness-brief/1\n')).toBe(true);
    expect(out.endsWith('\n```')).toBe(true);
    const body = out.slice('```yaml\n'.length, -'\n```'.length);
    const parsed = parseYaml(body);
    expect(HeaderSchema.parse(parsed)).toEqual(sampleHeader());
  });

  it('keeps null worktree as null', () => {
    const out = renderHeader({ ...sampleHeader(), worktree: null });
    const body = out.slice('```yaml\n'.length, -'\n```'.length);
    expect(parseYaml(body).worktree).toBeNull();
  });
});

describe('docs/brief-contract.md', () => {
  it('documents every header key', () => {
    const doc = fs.readFileSync(path.join(repoRoot, 'docs', 'brief-contract.md'), 'utf8');
    for (const key of Object.keys(sampleHeader())) {
      expect(doc, `missing key ${key}`).toContain(key);
    }
    expect(doc).toContain(BRIEF_CONTRACT);
  });
});
