import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULTS } from './defaults.js';
import { HarnessConfigSchema } from './schema.js';
import { documentError, lineOfPath, parseYamlDocument } from './yaml.js';
export const USER_CONFIG_RELATIVE = path.join('.harness', 'config.yaml');
export const REPO_CONFIG_FILE = '.harness.yaml';
export const MIGRATION_NOTE = 'run `system config` to migrate';
function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/** Recursive merge: maps merge, lists and scalars replace, undefined is ignored. */
export function deepMerge(base, over) {
    if (!isPlainObject(base) || !isPlainObject(over)) {
        return (over === undefined ? base : over);
    }
    const out = { ...base };
    for (const [key, value] of Object.entries(over)) {
        if (value === undefined)
            continue;
        const current = out[key];
        out[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
    }
    return out;
}
/** Path to the user config file: HARNESS_CONFIG, else <home>/.harness/config.yaml. */
export function userConfigPath(env) {
    if (env.HARNESS_CONFIG)
        return env.HARNESS_CONFIG;
    return path.join(env.HARNESS_HOME || os.homedir(), USER_CONFIG_RELATIVE);
}
/** Walk up from `cwd` to the directory containing `.git`, or null. */
export function findGitRoot(cwd) {
    let dir = path.resolve(cwd);
    for (;;) {
        if (fs.existsSync(path.join(dir, '.git')))
            return dir;
        const parent = path.dirname(dir);
        if (parent === dir)
            return null;
        dir = parent;
    }
}
function defOf(schema) {
    return schema._zod.def;
}
function unwrap(schema) {
    let s = schema;
    for (;;) {
        const d = defOf(s);
        if ((d.type === 'optional' || d.type === 'nullable' || d.type === 'default') && d.innerType)
            s = d.innerType;
        else
            return s;
    }
}
/** Schema node reached by following `segments` through objects, records and arrays. */
function schemaAt(root, segments) {
    let s = unwrap(root);
    for (const seg of segments) {
        if (!s)
            return null;
        const d = defOf(s);
        if (d.type === 'object' && d.shape)
            s = d.shape[String(seg)] ?? null;
        else if (d.type === 'record' && d.valueType)
            s = d.valueType;
        else if (d.type === 'array' && d.element)
            s = d.element;
        else
            return null;
        if (s)
            s = unwrap(s);
    }
    return s;
}
/** Keys allowed at the object found at `segments`, or undefined if not an object. */
export function validKeysAt(root, segments) {
    const s = schemaAt(root, segments);
    if (!s)
        return undefined;
    const d = defOf(s);
    return d.type === 'object' && d.shape ? Object.keys(d.shape) : undefined;
}
// ---- layer validation ---------------------------------------------------------
function issueToError(issue, file, located) {
    const base = issue.path.map((p) => String(typeof p === 'symbol' ? p.description : p));
    let segments = [...issue.path.filter((p) => typeof p !== 'symbol')];
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
export function validateLayer(raw, file, located) {
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
        const issue = result.error.issues[0];
        return { error: issueToError(issue, file, located) };
    }
    return { config: result.data };
}
function loadFileLayer(name, file) {
    if (!file || !fs.existsSync(file))
        return { report: { name, file: null, ok: true }, config: null };
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    }
    catch (e) {
        const error = { file, path: '', line: null, message: `cannot read file: ${e.message}` };
        return { report: { name, file, ok: false, error }, config: null };
    }
    const located = parseYamlDocument(text);
    const syntax = documentError(located, file);
    if (syntax)
        return { report: { name, file, ok: false, error: syntax }, config: null };
    const validated = validateLayer(located.doc.toJS() ?? {}, file, located);
    if ('error' in validated)
        return { report: { name, file, ok: false, error: validated.error }, config: null };
    return { report: { name, file, ok: true }, config: validated.config };
}
/**
 * Load configuration: defaults → kit fragments → user file → repo file.
 * A broken layer is skipped and reported; this never throws.
 */
export function loadConfig(opts) {
    const env = opts.env ?? process.env;
    const layers = [];
    const errors = [];
    let config = structuredClone(DEFAULTS);
    layers.push({ name: 'defaults', file: null, ok: true });
    for (const [i, fragment] of (opts.kitFragments ?? []).entries()) {
        const file = `kit-fragment-${i + 1}`;
        const validated = validateLayer(fragment, file, null);
        if ('error' in validated) {
            layers.push({ name: 'kit', file: null, ok: false, error: validated.error });
            errors.push(validated.error);
        }
        else {
            layers.push({ name: 'kit', file: null, ok: true });
            config = deepMerge(config, validated.config);
        }
    }
    const user = loadFileLayer('user', userConfigPath(env));
    layers.push(user.report);
    if (user.report.error)
        errors.push(user.report.error);
    if (user.config)
        config = deepMerge(config, user.config);
    const gitRoot = findGitRoot(opts.cwd);
    const repo = loadFileLayer('repo', gitRoot ? path.join(gitRoot, REPO_CONFIG_FILE) : null);
    layers.push(repo.report);
    if (repo.report.error)
        errors.push(repo.report.error);
    if (repo.config)
        config = deepMerge(config, repo.config);
    return { config, layers, errors };
}
