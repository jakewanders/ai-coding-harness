import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { validateLayer } from '../config/validate.js';
import { parseYamlDocument, documentError } from '../config/yaml.js';
function strings(v) {
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}
function parseRules(raw, file) {
    const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.rules) ? raw.rules : [];
    const rules = [];
    for (const [i, r] of list.entries()) {
        if (!isRecord(r) || typeof r.id !== 'string' || typeof r.pattern !== 'string' || typeof r.files !== 'string' || typeof r.message !== 'string') {
            return { error: { file, path: `rules.${i}`, line: null, message: 'rule needs id, pattern, files and message', valid_keys: ['id', 'pattern', 'files', 'severity', 'message'] } };
        }
        const severity = r.severity;
        if (severity !== undefined && !['blocker', 'major', 'minor', 'note'].includes(String(severity))) {
            return { error: { file, path: `rules.${i}.severity`, line: null, message: `severity must be blocker, major, minor or note; got ${JSON.stringify(severity)}` } };
        }
        rules.push({ id: r.id, pattern: r.pattern, files: r.files, severity: severity ?? 'minor', message: r.message });
    }
    return rules;
}
function isRecord(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/** Read `<dir>/kit.yaml` (config fragment plus docs and rules) and `<dir>/rules.yaml`. */
export function loadKit(dir) {
    const file = path.join(dir, 'kit.yaml');
    if (!fs.existsSync(file))
        return { error: { file, path: '', line: null, message: 'kit.yaml missing' } };
    const located = parseYamlDocument(fs.readFileSync(file, 'utf8'));
    const syntax = documentError(located, file);
    if (syntax)
        return { error: syntax };
    const raw = located.doc.toJS() ?? {};
    if (!isRecord(raw))
        return { error: { file, path: '', line: null, message: 'kit.yaml must be a mapping' } };
    const { docs: rawDocs, rules: rawRules, ...fragmentRaw } = raw;
    const docs = [];
    for (const d of Array.isArray(rawDocs) ? rawDocs : []) {
        if (!isRecord(d) || typeof d.path !== 'string')
            return { error: { file, path: 'docs', line: null, message: 'each doc needs a path', valid_keys: ['path', 'tags', 'capabilities'] } };
        docs.push({ path: path.resolve(dir, d.path), tags: strings(d.tags), capabilities: strings(d.capabilities) });
    }
    let rules = parseRules(rawRules ?? [], file);
    if ('error' in rules)
        return rules;
    const rulesFile = path.join(dir, 'rules.yaml');
    if (fs.existsSync(rulesFile)) {
        const extra = parseRules(parseYaml(fs.readFileSync(rulesFile, 'utf8')), rulesFile);
        if ('error' in extra)
            return extra;
        rules = [...rules, ...extra];
    }
    const validated = validateLayer(fragmentRaw, file, located);
    if ('error' in validated)
        return validated;
    const fragment = { ...validated.config };
    if (rules.length)
        fragment.diffaudit = { rules: [...(fragment.diffaudit?.rules ?? []), ...rules] };
    return { name: path.basename(dir), dir, fragment, docs, rules };
}
