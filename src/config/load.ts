import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { z } from 'zod';
import type { ConfigError } from '../contracts/header.js';
import { DEFAULTS } from './defaults.js';
import { HarnessConfigSchema, type HarnessConfig } from './schema.js';
import { documentError, lineOfPath, parseYamlDocument, type LocatedDocument } from './yaml.js';

export type { ConfigError } from '../contracts/header.js';
export type { HarnessConfig } from './schema.js';

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
}

export const USER_CONFIG_RELATIVE = path.join('.harness', 'config.yaml');
export const REPO_CONFIG_FILE = '.harness.yaml';
export const MIGRATION_NOTE = 'run `system config` to migrate';

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

// ---- zod shape walking, for valid_keys ---------------------------------------

type Def = { type: string; shape?: Record<string, z.ZodTypeAny>; innerType?: z.ZodTypeAny; valueType?: z.ZodTypeAny; element?: z.ZodTypeAny };

function defOf(schema: z.ZodTypeAny): Def {
  return (schema as unknown as { _zod: { def: Def } })._zod.def;
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s = schema;
  for (;;) {
    const d = defOf(s);
    if ((d.type === 'optional' || d.type === 'nullable' || d.type === 'default') && d.innerType) s = d.innerType;
    else return s;
  }
}

/** Schema node reached by following `segments` through objects, records and arrays. */
function schemaAt(root: z.ZodTypeAny, segments: Array<string | number>): z.ZodTypeAny | null {
  let s: z.ZodTypeAny | null = unwrap(root);
  for (const seg of segments) {
    if (!s) return null;
    const d = defOf(s);
    if (d.type === 'object' && d.shape) s = d.shape[String(seg)] ?? null;
    else if (d.type === 'record' && d.valueType) s = d.valueType;
    else if (d.type === 'array' && d.element) s = d.element;
    else return null;
    if (s) s = unwrap(s);
  }
  return s;
}

/** Keys allowed at the object found at `segments`, or undefined if not an object. */
export function validKeysAt(root: z.ZodTypeAny, segments: Array<string | number>): string[] | undefined {
  const s = schemaAt(root, segments);
  if (!s) return undefined;
  const d = defOf(s);
  return d.type === 'object' && d.shape ? Object.keys(d.shape) : undefined;
}

// ---- layer validation ---------------------------------------------------------

function issueToError(issue: z.core.$ZodIssue, file: string, located: LocatedDocument | null): ConfigError {
  const base = issue.path.map((p) => String(typeof p === 'symbol' ? p.description : p));
  let segments: Array<string | number> = [...issue.path.filter((p): p is string | number => typeof p !== 'symbol')];
  let message = issue.message;
  let parentSegments = segments.slice(0, -1);
  if (issue.code === 'unrecognized_keys') {
    const key = issue.keys[0] ?? '';
    parentSegments = segments;
    segments = [...segments, key];
    message = `unknown key "${key}"`;
  }
  const dotted = [...base, ...(issue.code === 'unrecognized_keys' ? [issue.keys[0] ?? ''] : [])].join('.');
  return {
    file,
    path: dotted,
    line: located ? lineOfPath(located, segments) : null,
    message,
    valid_keys: validKeysAt(HarnessConfigSchema, parentSegments),
  };
}

/** Validate one layer's raw value. Returns the typed config or a single ConfigError. */
export function validateLayer(raw: unknown, file: string, located: LocatedDocument | null): { config: HarnessConfig } | { error: ConfigError } {
  if (!isPlainObject(raw)) {
    return { error: { file, path: '', line: located ? lineOfPath(located, []) : null, message: 'config must be a mapping' } };
  }
  if ('schema' in raw && raw.schema !== 1) {
    return {
      error: {
        file,
        path: 'schema',
        line: located ? lineOfPath(located, ['schema']) : null,
        message: `unsupported config schema ${JSON.stringify(raw.schema)}; expected 1 (${MIGRATION_NOTE})`,
      },
    };
  }
  const result = HarnessConfigSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    return { error: issueToError(issue, file, located) };
  }
  return { config: result.data };
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

/**
 * Load configuration: defaults → kit fragments → user file → repo file.
 * A broken layer is skipped and reported; this never throws.
 */
export function loadConfig(opts: { cwd: string; env?: NodeJS.ProcessEnv; kitFragments?: Partial<HarnessConfig>[] }): LoadedConfig {
  const env = opts.env ?? process.env;
  const layers: LayerReport[] = [];
  const errors: ConfigError[] = [];
  let config: HarnessConfig = structuredClone(DEFAULTS);
  layers.push({ name: 'defaults', file: null, ok: true });

  for (const [i, fragment] of (opts.kitFragments ?? []).entries()) {
    const file = `kit-fragment-${i + 1}`;
    const validated = validateLayer(fragment, file, null);
    if ('error' in validated) {
      layers.push({ name: 'kit', file: null, ok: false, error: validated.error });
      errors.push(validated.error);
    } else {
      layers.push({ name: 'kit', file: null, ok: true });
      config = deepMerge(config, validated.config);
    }
  }

  const user = loadFileLayer('user', userConfigPath(env));
  layers.push(user.report);
  if (user.report.error) errors.push(user.report.error);
  if (user.config) config = deepMerge(config, user.config);

  const gitRoot = findGitRoot(opts.cwd);
  const repo = loadFileLayer('repo', gitRoot ? path.join(gitRoot, REPO_CONFIG_FILE) : null);
  layers.push(repo.report);
  if (repo.report.error) errors.push(repo.report.error);
  if (repo.config) config = deepMerge(config, repo.config);

  return { config, layers, errors };
}
