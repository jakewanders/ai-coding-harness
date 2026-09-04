import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inferProfile, type Guess } from '../../src/config/infer.js';
import { makeRepo } from '../helpers/git.js';
import { makeTmpDir } from '../helpers/tmp.js';

function find(guesses: Guess[], field: string): Guess | undefined {
  return guesses.find((g) => g.field === field);
}

describe('inferProfile', () => {
  it('infers npm and the manifest scripts for a node repo with a package-lock', () => {
    const repo = makeRepo({
      'package.json': JSON.stringify({
        name: 'x',
        scripts: { test: 'vitest run', lint: 'eslint .', typecheck: 'tsc --noEmit', e2e: 'playwright test', check: 'npm run lint && npm test' },
      }),
      'package-lock.json': '{}',
    });
    const { guesses } = inferProfile(repo);
    expect(find(guesses, 'package_manager')).toMatchObject({ value: 'npm' });
    expect(find(guesses, 'package_manager')!.evidence).toContain('package-lock.json');
    expect(find(guesses, 'commands.install')).toMatchObject({ value: 'npm ci' });
    expect(find(guesses, 'commands.test')).toMatchObject({ value: 'npm test' });
    expect(find(guesses, 'commands.test')!.evidence).toMatch(/scripts\.test/);
    expect(find(guesses, 'commands.lint')).toMatchObject({ value: 'npm run lint' });
    expect(find(guesses, 'commands.lint')!.evidence).toMatch(/scripts\.lint/);
    expect(find(guesses, 'commands.typecheck')).toMatchObject({ value: 'npm run typecheck' });
    expect(find(guesses, 'commands.typecheck')!.evidence).toMatch(/scripts\.typecheck/);
    expect(find(guesses, 'commands.e2e')).toMatchObject({ value: 'npm run e2e' });
    expect(find(guesses, 'commands.check')).toMatchObject({ value: 'npm run check' });
    expect(find(guesses, 'base_branch')).toMatchObject({ value: 'main' });
  });

  it('picks pnpm and yarn from their lockfiles', () => {
    const pnpm = inferProfile(makeRepo({ 'package.json': '{"scripts":{"test":"x"}}', 'pnpm-lock.yaml': '' }));
    expect(find(pnpm.guesses, 'package_manager')).toMatchObject({ value: 'pnpm' });
    expect(find(pnpm.guesses, 'commands.test')).toMatchObject({ value: 'pnpm test' });
    const yarn = inferProfile(makeRepo({ 'package.json': '{"scripts":{"lint":"x"}}', 'yarn.lock': '' }));
    expect(find(yarn.guesses, 'package_manager')).toMatchObject({ value: 'yarn' });
    expect(find(yarn.guesses, 'commands.lint')).toMatchObject({ value: 'yarn lint' });
  });

  it('infers pytest for a pyproject that lists it as a dependency', () => {
    const repo = makeRepo({
      'pyproject.toml': [
        '[project]',
        'name = "x"',
        'dependencies = ["requests"]',
        '[project.optional-dependencies]',
        'dev = ["pytest>=8", "ruff", "mypy"]',
        '',
      ].join('\n'),
    });
    const { guesses } = inferProfile(repo);
    expect(find(guesses, 'commands.test')!.value).toContain('pytest');
    expect(find(guesses, 'commands.test')!.evidence).toContain('pyproject.toml');
    expect(find(guesses, 'commands.lint')!.value).toContain('ruff');
    expect(find(guesses, 'commands.typecheck')!.value).toContain('mypy');
    expect(find(guesses, 'package_manager')).toMatchObject({ value: 'pip' });
  });

  it('does not guess pytest when it is absent from pyproject', () => {
    const { guesses } = inferProfile(makeRepo({ 'pyproject.toml': '[project]\nname = "x"\n' }));
    expect(find(guesses, 'commands.test')).toBeUndefined();
  });

  it('reads go, rust, composer and Makefile manifests', () => {
    const go = inferProfile(makeRepo({ 'go.mod': 'module example.test/m\n', 'Makefile': 'lint:\n\tgolangci-lint run\n' }));
    expect(find(go.guesses, 'commands.test')).toMatchObject({ value: 'go test ./...' });
    expect(find(go.guesses, 'commands.lint')).toMatchObject({ value: 'make lint' });
    const rust = inferProfile(makeRepo({ 'Cargo.toml': '[package]\nname = "x"\n' }));
    expect(find(rust.guesses, 'commands.test')).toMatchObject({ value: 'cargo test' });
    expect(find(rust.guesses, 'package_manager')).toMatchObject({ value: 'cargo' });
    const php = inferProfile(makeRepo({ 'composer.json': JSON.stringify({ 'require-dev': { 'phpunit/phpunit': '^11' }, scripts: { lint: 'phpcs' } }) }));
    expect(find(php.guesses, 'commands.install')).toMatchObject({ value: 'composer install' });
    expect(find(php.guesses, 'commands.test')!.value).toContain('phpunit');
    expect(find(php.guesses, 'commands.lint')).toMatchObject({ value: 'composer run lint' });
    const make = inferProfile(makeRepo({ 'Makefile': 'test:\n\t./run-tests\n\ncheck: test\n\t./check\n' }));
    expect(find(make.guesses, 'commands.test')).toMatchObject({ value: 'make test' });
    expect(find(make.guesses, 'commands.check')).toMatchObject({ value: 'make check' });
  });

  it('namespaces a repo without a remote under local/', () => {
    const repo = makeRepo({ 'a': '1' });
    const { namespace } = inferProfile(repo);
    expect(namespace.startsWith('local/')).toBe(true);
    expect(namespace).toBe(`local/${path.basename(repo)}`);
  });

  it('derives the namespace from the remote when present', () => {
    const repo = makeRepo({ 'a': '1' }, { remote: 'https://example.test/o/n.git' });
    expect(inferProfile(repo).namespace).toBe('example.test/o/n');
  });

  it('returns zero guesses for an empty non-git directory without throwing', () => {
    const dir = makeTmpDir('harness-empty');
    const result = inferProfile(dir);
    expect(result.guesses).toEqual([]);
    expect(result.namespace).toBe(`local/${path.basename(dir)}`);
  });

  it('never guesses a field twice', () => {
    const { guesses } = inferProfile(makeRepo({ 'package.json': '{"scripts":{"test":"x"}}', 'Makefile': 'test:\n\tmake-test\n' }));
    const fields = guesses.map((g) => g.field);
    expect(new Set(fields).size).toBe(fields.length);
    expect(find(guesses, 'commands.test')).toMatchObject({ value: 'npm test' });
  });
});
