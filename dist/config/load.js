import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULTS } from './defaults.js';
import { discoverKits } from '../kits/discover.js';
import { validateLayer } from './validate.js';
import { documentError, parseYamlDocument } from './yaml.js';
export { MIGRATION_NOTE, validKeysAt, validateLayer } from './validate.js';
export const USER_CONFIG_RELATIVE = path.join('.harness', 'config.yaml');
export const REPO_CONFIG_FILE = '.harness.yaml';
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
function mergeLayers(defaults, kitFragments, user, repo) {
    const layers = [{ name: 'defaults', file: null, ok: true }];
    const errors = [];
    let config = structuredClone(defaults);
    for (const { fragment, file } of kitFragments) {
        const validated = validateLayer(fragment, file, null);
        if ('error' in validated) {
            layers.push({ name: 'kit', file, ok: false, error: validated.error });
            errors.push(validated.error);
        }
        else {
            layers.push({ name: 'kit', file, ok: true });
            config = deepMerge(config, validated.config);
        }
    }
    for (const layer of [user, repo]) {
        layers.push(layer.report);
        if (layer.report.error)
            errors.push(layer.report.error);
        if (layer.config)
            config = deepMerge(config, layer.config);
    }
    return { config, layers, errors };
}
/**
 * Load configuration: defaults → kit fragments → user file → repo file.
 * Kits named by the user and repo layers are discovered along the kit search
 * path and merged below them. A broken layer is skipped and reported; this
 * never throws.
 */
export function loadConfig(opts) {
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
