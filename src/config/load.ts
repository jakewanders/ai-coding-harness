import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ConfigError } from '../contracts/header.js';
import { DEFAULTS } from './defaults.js';
import type { HarnessConfig } from './schema.js';
import { discoverKits, type Kit } from '../kits/discover.js';
import { validateLayer } from './validate.js';
import { documentError, lineOfPath, parseYamlDocument, type LocatedDocument } from './yaml.js';

export type { ConfigError } from '../contracts/header.js';
export type { HarnessConfig } from './schema.js';
export { MIGRATION_NOTE, validKeysAt, validateLayer } from './validate.js';

export interface LayerReport {
  name: 'defaults' | 'kit' | 'user' | 'repo';
  file: string | null;
  ok: boolean;
  error?: ConfigError;
}

export interface LoadedConfig {
  config: HarnessConfig;
  layers: LayerReport[];
  errors: ConfigError[];
  /** Kits discovered from the merged `kits` list (empty when none). */
  kits: Kit[];
}

export const USER_CONFIG_RELATIVE = path.join('.harness', 'config.yaml');
export const REPO_CONFIG_FILE = '.harness.yaml';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Recursive merge: maps merge, lists and scalars replace, undefined is ignored. */
export function deepMerge<T>(base: T, over: Partial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(over)) {
    return (over === undefined ? base : (over as T));
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return out as T;
}

/** Path to the user config file: HARNESS_CONFIG, else <home>/.harness/config.yaml. */
export function userConfigPath(env: NodeJS.ProcessEnv): string {
  if (env.HARNESS_CONFIG) return env.HARNESS_CONFIG;
  return path.join(env.HARNESS_HOME || os.homedir(), USER_CONFIG_RELATIVE);
}

/** Walk up from `cwd` to the directory containing `.git`, or null. */
export function findGitRoot(cwd: string): string | null {
  let dir = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadFileLayer(name: 'user' | 'repo', file: string | null): { report: LayerReport; config: HarnessConfig | null } {
  if (!file || !fs.existsSync(file)) return { report: { name, file: null, ok: true }, config: null };
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    const error: ConfigError = { file, path: '', line: null, message: `cannot read file: ${(e as Error).message}` };
    return { report: { name, file, ok: false, error }, config: null };
  }
  const located = parseYamlDocument(text);
  const syntax = documentError(located, file);
  if (syntax) return { report: { name, file, ok: false, error: syntax }, config: null };
  const validated = validateLayer(located.doc.toJS() ?? {}, file, located);
  if ('error' in validated) return { report: { name, file, ok: false, error: validated.error }, config: null };
  return { report: { name, file, ok: true }, config: validated.config };
}

export interface LoadOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  kitFragments?: Partial<HarnessConfig>[];
  /** Plugin install root, for the kit search path; defaults to the process cwd. */
  pluginRoot?: string;
}

function mergeLayers(defaults: HarnessConfig, kitFragments: Array<{ fragment: Partial<HarnessConfig>; file: string }>, user: LoadedLayer, repo: LoadedLayer): { config: HarnessConfig; layers: LayerReport[]; errors: ConfigError[] } {
  const layers: LayerReport[] = [{ name: 'defaults', file: null, ok: true }];
  const errors: ConfigError[] = [];
  let config: HarnessConfig = structuredClone(defaults);
  for (const { fragment, file } of kitFragments) {
    const validated = validateLayer(fragment, file, null);
    if ('error' in validated) {
      layers.push({ name: 'kit', file, ok: false, error: validated.error });
      errors.push(validated.error);
    } else {
      layers.push({ name: 'kit', file, ok: true });
      config = deepMerge(config, validated.config);
    }
  }
  for (const layer of [user, repo]) {
    layers.push(layer.report);
    if (layer.report.error) errors.push(layer.report.error);
    if (layer.config) config = deepMerge(config, layer.config);
  }
  return { config, layers, errors };
}

type LoadedLayer = ReturnType<typeof loadFileLayer>;

/**
 * Load configuration: defaults → kit fragments → user file → repo file.
 * Kits named by the user and repo layers are discovered along the kit search
 * path and merged below them. A broken layer is skipped and reported; this
 * never throws.
 */
export function loadConfig(opts: LoadOptions): LoadedConfig {
  const env = opts.env ?? process.env;
  const user = loadFileLayer('user', userConfigPath(env));
  const gitRoot = findGitRoot(opts.cwd);
  const repo = loadFileLayer('repo', gitRoot ? path.join(gitRoot, REPO_CONFIG_FILE) : null);

  const explicit = (opts.kitFragments ?? []).map((fragment, i) => ({ fragment, file: `kit-fragment-${i + 1}` }));
  const first = mergeLayers(DEFAULTS, explicit, user, repo);
  const names = first.config.kits ?? [];
  const home = env.HARNESS_HOME || os.homedir();
  const discovery = names.length ? discoverKits(names, env, home, opts.pluginRoot ?? process.cwd()) : [];
  const missing = names.filter((n) => !discovery.some((k) => k.name === n));
  const kitLayers = [...discovery.map((k) => ({ fragment: k.fragment, file: path.join(k.dir, 'kit.yaml') })), ...explicit];
  const merged = mergeLayers(DEFAULTS, kitLayers, user, repo);
  const errors = [...merged.errors];
  for (const name of missing) {
    errors.push({ file: repo.report.file ?? user.report.file ?? 'config', path: 'kits', line: null, message: `kit "${name}" not found on the kit search path (HARNESS_KIT_PATHS, ~/.harness/kits, plugin cache, ../ai-coding-harness-kits/kits)` });
  }
  return { config: merged.config, layers: merged.layers, errors, kits: discovery };
}
