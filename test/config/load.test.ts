import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import { deepMerge, loadConfig } from '../../src/config/load.js';
import { parseYamlLocated } from '../../src/config/yaml.js';
import { makeTmpDir } from '../helpers/tmp.js';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'config');

function fixture(name: string): string {
  return fs.readFileSync(path.join(fixtures, name), 'utf8');
}

/** A fake git checkout: `<root>/.git` plus an optional `.harness.yaml`, cwd nested below. */
function fakeRepo(repoYaml?: string): { root: string; cwd: string } {
  const root = makeTmpDir('harness-repo');
  fs.mkdirSync(path.join(root, '.git'));
  const cwd = path.join(root, 'packages', 'deep');
  fs.mkdirSync(cwd, { recursive: true });
  if (repoYaml !== undefined) fs.writeFileSync(path.join(root, '.harness.yaml'), repoYaml);
  return { root, cwd };
}

function userFile(text: string): string {
  const file = process.env.HARNESS_CONFIG!;
  fs.writeFileSync(file, text);
  return file;
}

describe('deepMerge', () => {
  it('merges maps recursively and replaces lists and scalars', () => {
    const base = { a: { x: 1, y: [1, 2], z: { k: 'base' } }, s: 'base', list: [1] };
    const over = { a: { y: [3], z: { j: 'over' } }, s: 'over' };
    expect(deepMerge(base, over)).toEqual({ a: { x: 1, y: [3], z: { k: 'base', j: 'over' } }, s: 'over', list: [1] });
  });

  it('ignores undefined overrides but honours null', () => {
    expect(deepMerge({ a: 1, b: 2 } as { a: number | null; b: number | undefined }, { a: null, b: undefined })).toEqual({ a: null, b: 2 });
  });
});

describe('parseYamlLocated', () => {
  it('returns the value for valid yaml', () => {
    expect(parseYamlLocated('a: 1\n', 'f.yaml')).toEqual({ value: { a: 1 } });
  });

  it('returns an error with a line for a syntax error', () => {
    const r = parseYamlLocated(fixture('syntax-error.yaml'), 'f.yaml');
    expect('error' in r).toBe(true);
    if ('error' in r) {
      expect(r.error.file).toBe('f.yaml');
      expect(r.error.line).not.toBeNull();
      expect(r.error.line).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('loadConfig', () => {
  it('yields DEFAULTS and no errors with an empty environment and no files', () => {
    const cwd = makeTmpDir('harness-nogit');
    const env = { HARNESS_HOME: makeTmpDir('harness-home-empty') };
    const loaded = loadConfig({ cwd, env });
    expect(loaded.config).toEqual(DEFAULTS);
    expect(loaded.errors).toEqual([]);
    expect(loaded.layers.map((l) => [l.name, l.ok])).toEqual([['defaults', true], ['user', true], ['repo', true]]);
    expect(loaded.layers.find((l) => l.name === 'repo')!.file).toBeNull();
  });

  it('lets repo lists replace user lists while nested maps merge', () => {
    userFile(fixture('user.yaml'));
    const { cwd } = fakeRepo(fixture('repo.yaml'));
    const loaded = loadConfig({ cwd, env: process.env });
    expect(loaded.errors).toEqual([]);
    const repo = loaded.config.repos!['local/proj']!;
    expect(repo.tags).toEqual(['repo-tag']);
    expect(repo.base_branch).toBe('develop');
    expect(repo.commands).toEqual({ test: 'npm run test:ci', lint: 'npm run lint' });
    expect(repo.capabilities).toEqual({ browser_ui: true });
    expect(loaded.config.store!.path).toBe('~/vault-user');
    expect(loaded.config.protected_branches).toEqual(['main', 'develop']);
    expect(loaded.layers.find((l) => l.name === 'repo')!.file).toMatch(/\.harness\.yaml$/);
  });

  it('skips a user file with schema: 0 and points at migration', () => {
    const file = userFile(fixture('schema0.yaml'));
    const cwd = makeTmpDir('harness-nogit');
    const loaded = loadConfig({ cwd, env: process.env });
    expect(loaded.config.store).toEqual(DEFAULTS.store);
    expect(loaded.errors).toHaveLength(1);
    expect(loaded.errors[0]).toMatchObject({ file, path: 'schema' });
    expect(loaded.errors[0]!.message).toMatch(/migrat/i);
    expect(loaded.errors[0]!.line).toBe(1);
    expect(loaded.layers.find((l) => l.name === 'user')).toMatchObject({ ok: false, file });
  });

  it('reports an unknown repo key with a dotted path and the valid sibling keys', () => {
    const { cwd } = fakeRepo(fixture('unknown-key.yaml'));
    const loaded = loadConfig({ cwd, env: process.env });
    expect(loaded.errors).toHaveLength(1);
    const err = loaded.errors[0]!;
    expect(err.path).toBe('repos.x.bogus_key');
    expect(err.valid_keys).toContain('base_branch');
    expect(err.valid_keys).toContain('commands');
    expect(err.line).toBe(5);
    expect(err.file).toMatch(/\.harness\.yaml$/);
    expect(loaded.config.repos).toEqual(DEFAULTS.repos);
  });

  it('reports a type error with its path and line', () => {
    const { cwd } = fakeRepo(fixture('bad-type.yaml'));
    const loaded = loadConfig({ cwd, env: process.env });
    expect(loaded.errors).toHaveLength(1);
    expect(loaded.errors[0]).toMatchObject({ path: 'repos.x.base_branch', line: 4 });
    expect(loaded.errors[0]!.valid_keys).toContain('base_branch');
  });

  it('reports a yaml syntax error with a non-null line and skips the layer', () => {
    const file = userFile(fixture('syntax-error.yaml'));
    const cwd = makeTmpDir('harness-nogit');
    const loaded = loadConfig({ cwd, env: process.env });
    expect(loaded.errors).toHaveLength(1);
    expect(loaded.errors[0]!.file).toBe(file);
    expect(loaded.errors[0]!.line).not.toBeNull();
    expect(loaded.config).toEqual(DEFAULTS);
  });

  it('places kit fragments below the user layer', () => {
    userFile('schema: 1\nprotected_branches: [user-branch]\n');
    const cwd = makeTmpDir('harness-nogit');
    const loaded = loadConfig({
      cwd,
      env: process.env,
      kitFragments: [{ protected_branches: ['from-kit'], gates: { kit_gate: { severity: 'warn', requires: null } } }],
    });
    expect(loaded.errors).toEqual([]);
    expect(loaded.config.protected_branches).toEqual(['user-branch']);
    expect(loaded.config.gates).toEqual({ kit_gate: { severity: 'warn', requires: null } });
    expect(loaded.layers.map((l) => l.name)).toEqual(['defaults', 'kit', 'user', 'repo']);
  });

  it('falls back to HARNESS_HOME/.harness/config.yaml when HARNESS_CONFIG is unset', () => {
    const home = process.env.HARNESS_HOME!;
    fs.mkdirSync(path.join(home, '.harness'), { recursive: true });
    fs.writeFileSync(path.join(home, '.harness', 'config.yaml'), 'schema: 1\nkits: [home-kit]\n');
    const { HARNESS_CONFIG: _drop, ...env } = process.env;
    const loaded = loadConfig({ cwd: makeTmpDir('harness-nogit'), env });
    expect(loaded.config.kits).toEqual(['home-kit']);
  });
});
