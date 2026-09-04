const IDENTITY = /\b(e-?mail|phone|ssn|address|first_?name|last_?name|full_?name|user\.name|\.name\b|dob|birth(?:day|date)?|token|password|passwd|secret)\b|[\w.+-]+@[\w-]+\.[\w.]+/i;
const SINKS = [
    [/console\.\w+\(|\blogger?\b|\.log\(|\blog\(/i, 'log'],
    [/\banalytics\b|\btrack\(|\btelemetry\b/i, 'analytics'],
    [/localStorage|sessionStorage|\bINSERT\b|\bUPDATE\b.*\bSET\b|\.save\(|\.persist\(/i, 'storage'],
    [/res\.status\([45]\d\d\)\.json|throw new \w*Error\(`[^`]*\$\{|\.status\([45]\d\d\)\.send/i, 'error_body'],
];
/** Added lines where an identity-shaped value flows into a sink. */
export function piiAudit(diff) {
    const out = [];
    for (const file of diff) {
        for (const { line, text } of file.added) {
            if (!IDENTITY.test(text))
                continue;
            const sink = SINKS.find(([re]) => re.test(text));
            if (!sink)
                continue;
            out.push({ file: file.path, line, sink: sink[1], text: text.trim() });
        }
    }
    return out;
}
