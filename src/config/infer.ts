import fs from 'node:fs';
import path from 'node:path';
import { defaultBranch, gitRoot, remoteUrl } from '../git/exec.js';
import { repoNamespace } from '../store/paths.js';

export interface Guess {
  field: string;
  value: string;
  evidence: string;
}

export interface InferredProfile {
  namespace: string;
  guesses: Guess[];
}

export const COMMAND_FIELDS = ['install', 'check', 'test', 'lint', 'typecheck', 'e2e'] as const;
type CommandField = (typeof COMMAND_FIELDS)[number];

/** Collects guesses; the first guess for a field wins, so readers run most-specific first. */
class Guesses {
  readonly list: Guess[] = [];
  add(field: string, value: string, evidence: string): void {
    if (this.list.some((g) => g.field === field)) return;
    this.list.push({ field, value, evidence });
  }
  command(name: CommandField, value: string, evidence: string): void {
    this.add(`commands.${name}`, value, evidence);
  }
}

function readText(root: string, name: string): string | null {
  const abs = path.join(root, name);
  try {
    return fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : null;
  } catch {
    return null;
  }
}

function readJson(root: string, name: string): Record<string, unknown> | null {
  const text = readText(root, name);
  if (text === null) return null;
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function scriptsOf(manifest: Record<string, unknown>): Record<string, string> {
  const s = manifest.scripts;
  if (typeof s !== 'object' || s === null) return {};
  return Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
}

// ---- readers ---------------------------------------------------------------------

const NODE_LOCKFILES: Array<[file: string, pm: string]> = [
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
  ['yarn.lock', 'yarn'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
];

const CHECK_SCRIPT_NAMES = ['check', 'ci', 'validate', 'verify'];

function readNode(root: string, g: Guesses): void {
  const pkg = readJson(root, 'package.json');
  if (!pkg) return;
  const lock = NODE_LOCKFILES.find(([file]) => readText(root, file) !== null);
  const pm = lock ? lock[1] : 'npm';
  g.add('package_manager', pm, lock ? `${lock[0]} present` : 'package.json present, no lockfile');
  const install: Record<string, string> = { npm: lock ? 'npm ci' : 'npm install', yarn: 'yarn install --frozen-lockfile', pnpm: 'pnpm install --frozen-lockfile', bun: 'bun install' };
  g.command('install', install[pm] ?? `${pm} install`, lock ? `${lock[0]} present` : 'package.json present');

  const scripts = scriptsOf(pkg);
  const run = (name: string): string => {
    if (name === 'test') return `${pm} test`;
    return pm === 'yarn' || pm === 'bun' ? `${pm} ${name}` : `${pm} run ${name}`;
  };
  for (const name of ['test', 'lint', 'typecheck', 'e2e'] as const) {
    if (scripts[name]) g.command(name, run(name), `package.json scripts.${name}`);
  }
  const check = CHECK_SCRIPT_NAMES.find((n) => scripts[n]);
  if (check) g.command('check', run(check), `package.json scripts.${check}`);
}

function readComposer(root: string, g: Guesses): void {
  const composer = readJson(root, 'composer.json');
  if (!composer) return;
  g.add('package_manager', 'composer', 'composer.json present');
  g.command('install', 'composer install', 'composer.json present');
  const scripts = scriptsOf(composer);
  for (const name of ['test', 'lint', 'check'] as const) {
    if (scripts[name]) g.command(name, `composer run ${name}`, `composer.json scripts.${name}`);
  }
  const dev = composer['require-dev'];
  const devDeps = typeof dev === 'object' && dev !== null ? Object.keys(dev) : [];
  if (devDeps.includes('phpunit/phpunit')) g.command('test', 'vendor/bin/phpunit', 'composer.json require-dev phpunit/phpunit');
  if (devDeps.includes('phpstan/phpstan')) g.command('typecheck', 'vendor/bin/phpstan analyse', 'composer.json require-dev phpstan/phpstan');
  if (devDeps.includes('squizlabs/php_codesniffer')) g.command('lint', 'vendor/bin/phpcs', 'composer.json require-dev squizlabs/php_codesniffer');
}

/** Very small TOML scan: every quoted string inside array values, plus table headers. */
function tomlStrings(text: string): string[] {
  return [...text.matchAll(/"([^"\n]+)"|'([^'\n]+)'/g)].map((m) => (m[1] ?? m[2] ?? '').trim());
}

function hasDep(strings: string[], name: string): boolean {
  const re = new RegExp(`^${name}(\\[|[<>=!~ ]|$)`, 'i');
  return strings.some((s) => re.test(s));
}

function readPython(root: string, g: Guesses): void {
  const text = readText(root, 'pyproject.toml');
  if (text === null) return;
  const strings = tomlStrings(text);
  const poetry = /^\[tool\.poetry\]/m.test(text);
  const uv = readText(root, 'uv.lock') !== null || /^\[tool\.uv\]/m.test(text);
  const pm = poetry ? 'poetry' : uv ? 'uv' : 'pip';
  g.add('package_manager', pm, poetry ? 'pyproject.toml [tool.poetry]' : uv ? 'uv.lock or [tool.uv] present' : 'pyproject.toml present');
  g.command('install', poetry ? 'poetry install' : uv ? 'uv sync' : 'pip install -e .', `pyproject.toml (${pm})`);
  const prefix = poetry ? 'poetry run ' : uv ? 'uv run ' : '';
  if (hasDep(strings, 'pytest')) g.command('test', `${prefix}pytest`, 'pyproject.toml lists pytest');
  if (hasDep(strings, 'ruff')) g.command('lint', `${prefix}ruff check .`, 'pyproject.toml lists ruff');
  else if (hasDep(strings, 'flake8')) g.command('lint', `${prefix}flake8`, 'pyproject.toml lists flake8');
  if (hasDep(strings, 'mypy')) g.command('typecheck', `${prefix}mypy .`, 'pyproject.toml lists mypy');
  else if (hasDep(strings, 'pyright')) g.command('typecheck', `${prefix}pyright`, 'pyproject.toml lists pyright');
}

function readGo(root: string, g: Guesses): void {
  if (readText(root, 'go.mod') === null) return;
  g.add('package_manager', 'go', 'go.mod present');
  g.command('install', 'go mod download', 'go.mod present');
  g.command('test', 'go test ./...', 'go.mod present');
  g.command('check', 'go vet ./...', 'go.mod present');
}

function readRust(root: string, g: Guesses): void {
  if (readText(root, 'Cargo.toml') === null) return;
  g.add('package_manager', 'cargo', 'Cargo.toml present');
  g.command('install', 'cargo fetch', 'Cargo.toml present');
  g.command('test', 'cargo test', 'Cargo.toml present');
  g.command('check', 'cargo check', 'Cargo.toml present');
  g.command('lint', 'cargo clippy', 'Cargo.toml present');
}

/** Target names declared in a Makefile (`name:` at line start, not `.PHONY`-style specials). */
export function makefileTargets(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/^([A-Za-z0-9_.-]+)\s*:(?!=)/gm)) {
    const name = m[1]!;
    if (!name.startsWith('.') && !out.includes(name)) out.push(name);
  }
  return out;
}

function readMakefile(root: string, g: Guesses): void {
  const text = readText(root, 'Makefile') ?? readText(root, 'makefile') ?? readText(root, 'GNUmakefile');
  if (text === null) return;
  const targets = makefileTargets(text);
  for (const name of COMMAND_FIELDS) {
    if (targets.includes(name)) g.command(name, `make ${name}`, `Makefile target ${name}`);
  }
}

// ---- entry point ---------------------------------------------------------------

/**
 * Inspect a directory and guess its repo profile. Every guess carries the
 * evidence it was drawn from. Never throws; an empty directory yields no guesses.
 */
export function inferProfile(cwd: string): InferredProfile {
  const root = gitRoot(cwd) ?? path.resolve(cwd);
  const namespace = repoNamespace(gitRoot(cwd) ? remoteUrl(root) : null, path.basename(root));
  const g = new Guesses();

  if (gitRoot(cwd)) {
    const branch = defaultBranch(root);
    const evidence = remoteUrl(root) ? 'origin/HEAD or local branch' : `local branch ${branch}`;
    g.add('base_branch', branch, evidence);
  }

  readNode(root, g);
  readComposer(root, g);
  readPython(root, g);
  readGo(root, g);
  readRust(root, g);
  readMakefile(root, g);

  return { namespace, guesses: g.list };
}
