import { globToRegExp } from '../analysis/files.js';
/** Rules from the merged config (kit fragments are already merged into it). */
export function loadRules(config) {
    return (config.diffaudit?.rules ?? []).map((r) => ({ id: r.id, pattern: r.pattern, files: r.files, severity: r.severity ?? 'minor', message: r.message }));
}
/** Match each rule's pattern against added lines in files matching its glob; invalid patterns are skipped. */
export function runRules(rules, diff) {
    const out = [];
    for (const file of diff) {
        for (const { line, text } of file.added) {
            for (const rule of rules) {
                let re;
                try {
                    re = new RegExp(rule.pattern);
                }
                catch {
                    continue;
                }
                if (!globToRegExp(rule.files).test(file.path))
                    continue;
                if (re.test(text))
                    out.push({ severity: rule.severity, text: `${rule.message} (${rule.id})`, path: file.path, line, rule: rule.id });
            }
        }
    }
    return out;
}
