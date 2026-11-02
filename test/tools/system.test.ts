import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { HarnessConfigSchema } from '../../src/config/schema.js';
import { VERSION } from '../../src/index.js';
import { dispatch } from '../../src/registry/tools.js';
import { ensureVault } from '../../src/store/vault.js';
import { systemTool } from '../../src/tools/system.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

function nodeRepo(extra: Record<string, string> = {}) {
  return makeRepo({
    'package.json': JSON.stringify({ name: 'x', scripts: { test: 'vitest run', lint: 'eslint .', typecheck: 'tsc --noEmit' } }),
    'package-lock.json': '{}',
    ...extra,
  });
}

describe('system doctor', () => {
  it('reports inference with evidence, layers, roles, kits, vault and build health, and proposes valid YAML', async () => {
    const repo = nodeRepo();
    const ctx = makeCtx({ cwd: repo });
    const r = await dispatch(systemTool, { action: 'doctor' }, ctx);
    expect(r.envelope.ok).toBe(true);
    const data = r.envelope.data as {
      profile: { namespace: string; guesses: Array<{ field: string; value: string; evidence: string }> };
      layers: Array<{ name: string; ok: boolean }>;
      roles: Record<string, unknown>;
      kits: unknown[];
      environments: unknown[];
      vault: { path: string; exists: boolean; git: boolean; remote: string | null };
      build: { dist: boolean; version: string | null; matches: boolean };
      proposed_repo_config: string;
      errors: unknown[];
    };
    expect(data.profile.guesses.find((g) => g.field === 'commands.test')).toMatchObject({ value: 'npm test' });
    expect(data.profile.guesses.find((g) => g.field === 'commands.lint')!.evidence).toContain('scripts.lint');
    expect(data.layers.map((l) => l.name)).toEqual(['defaults', 'user', 'repo']);
    expect(data.roles.tracker).toBe('unwired');
    expect(data.kits).toEqual([]);
    expect(data.vault).toMatchObject({ git: false, remote: null });
    expect(data.vault.path.length).toBeGreaterThan(0);
    expect(data.build).toMatchObject({ dist: true, matches: true });
    expect(data.build.version).toBe(VERSION);
    const proposed = parseYaml(data.proposed_repo_config) as Record<string, unknown>;
    expect(HarnessConfigSchema.safeParse(proposed).success).toBe(true);
    expect(proposed.schema).toBe(1);
    const repos = proposed.repos as Record<string, { base_branch: string; commands: Record<string, string>; constraints: { package_manager: string } }>;
    expect(repos[data.profile.namespace]).toMatchObject({ base_branch: 'main', commands: { test: 'npm test', lint: 'npm run lint', typecheck: 'npm run typecheck' }, constraints: { package_manager: 'npm' } });
    expect(r.text).toContain('npm test');
    expect(r.text).toContain('scripts.test');
    expect(r.text).toMatch(/vault/i);
    expect(r.text).toMatch(/dist/);
    ensureVault(ctx.vault);
    const again = (await dispatch(systemTool, { action: 'doctor' }, ctx)).envelope.data as { vault: { exists: boolean; git: boolean } };
    expect(again.vault).toMatchObject({ exists: true, git: true });
  });

  it('surfaces config errors and never writes anything', async () => {
    const repo = nodeRepo({ '.harness.yaml': 'schema: 1\nrepos:\n  x:\n    bogus: 1\n' });
    const before = fs.readdirSync(repo).sort();
    const r = await dispatch(systemTool, { action: 'doctor' }, makeCtx({ cwd: repo }));
    expect((r.envelope.data as { errors: Array<{ path: string }> }).errors[0]!.path).toBe('repos.x.bogus');
    expect(r.text).toContain('repos.x.bogus');
    expect(fs.readdirSync(repo).sort()).toEqual(before);
  });
});

describe('system config', () => {
  it('merged shows the effective config with a provenance map', async () => {
    const repo = nodeRepo({ '.harness.yaml': 'schema: 1\nprotected_branches: [main, develop]\nrepos:\n  "local/x":\n    base_branch: develop\n' });
    fs.writeFileSync(process.env.HARNESS_CONFIG!, 'schema: 1\nstore:\n  path: ~/custom-vault\n');
    const r = await dispatch(systemTool, { action: 'config', mode: 'merged' }, makeCtx({ cwd: repo }));
    expect(r.envelope.ok).toBe(true);
    const data = r.envelope.data as { config: Record<string, unknown>; provenance: Record<string, string> };
    expect((data.config.store as { path: string }).path).toBe('~/custom-vault');
    expect(data.provenance['store.path']).toBe('user');
    expect(data.provenance['protected_branches']).toBe('repo');
    expect(data.provenance['repos.local/x.base_branch']).toBe('repo');
    expect(data.provenance['store.remote']).toBe('defaults');
    expect(r.text).toContain('store.path');
  });

  it('propose returns the doctor proposal; write refuses to overwrite without the flag and writes when allowed', async () => {
    const repo = nodeRepo();
    const ctx = makeCtx({ cwd: repo });
    const propose = await dispatch(systemTool, { action: 'config', mode: 'propose' }, ctx);
    expect(propose.envelope.ok).toBe(true);
    const yaml = (propose.envelope.data as { yaml: string }).yaml;
    expect(parseYaml(yaml)).toMatchObject({ schema: 1 });
    const noYaml = await dispatch(systemTool, { action: 'config', mode: 'write' }, ctx);
    expect(noYaml.envelope.ok).toBe(false);
    const first = await dispatch(systemTool, { action: 'config', mode: 'write', yaml }, ctx);
    expect(first.envelope.ok).toBe(true);
    expect(fs.readFileSync(path.join(repo, '.harness.yaml'), 'utf8')).toBe(yaml);
    const refused = await dispatch(systemTool, { action: 'config', mode: 'write', yaml: 'schema: 1\nkits: []\n' }, ctx);
    expect(refused.envelope.ok).toBe(false);
    expect(refused.envelope.summary).toMatch(/overwrite/);
    expect(fs.readFileSync(path.join(repo, '.harness.yaml'), 'utf8')).toBe(yaml);
    const forced = await dispatch(systemTool, { action: 'config', mode: 'write', yaml: 'schema: 1\nkits: []\n', overwrite: true }, ctx);
    expect(forced.envelope.ok).toBe(true);
    expect(fs.readFileSync(path.join(repo, '.harness.yaml'), 'utf8')).toBe('schema: 1\nkits: []\n');
    const invalid = await dispatch(systemTool, { action: 'config', mode: 'write', yaml: 'schema: 1\nrepos:\n  x:\n    bogus: 1\n', overwrite: true }, ctx);
    expect(invalid.envelope.ok).toBe(false);
    expect(fs.readFileSync(path.join(repo, '.harness.yaml'), 'utf8')).toBe('schema: 1\nkits: []\n');
  });
});

describe('system infer', () => {
  it('infer exposes the profile guesses', async () => {
    const r = await dispatch(systemTool, { action: 'infer' }, makeCtx({ cwd: nodeRepo() }));
    expect(r.envelope.ok).toBe(true);
    expect((r.envelope.data as { guesses: Array<{ field: string }> }).guesses.map((g) => g.field)).toContain('package_manager');
  });
});
