import { LineCounter, parseDocument } from 'yaml';
/** Parse YAML keeping the document so paths can be mapped back to lines. */
export function parseYamlDocument(text) {
    const lineCounter = new LineCounter();
    const doc = parseDocument(text, { lineCounter, prettyErrors: true });
    return { doc, lineCounter };
}
/** First syntax error of a parsed document as a ConfigError, or null. */
export function documentError(located, file) {
    const err = located.doc.errors[0];
    if (!err)
        return null;
    const line = err.linePos?.[0]?.line ?? null;
    const message = err.message.split('\n')[0] ?? err.message;
    return { file, path: '', line, message: `YAML syntax error: ${message}` };
}
/**
 * Parse YAML text. On success returns the plain value; on a syntax error
 * returns a ConfigError with the line filled from the parser's line counter.
 */
export function parseYamlLocated(text, file) {
    const located = parseYamlDocument(text);
    const error = documentError(located, file);
    if (error)
        return { error };
    return { value: located.doc.toJS() ?? {} };
}
function isMap(node) {
    return typeof node === 'object' && node !== null && 'items' in node && Array.isArray(node.items);
}
/**
 * 1-based line of the value at `path`, or of the key `path[last]` inside the
 * map at `path[0..-1]` when that key exists. Null when unresolvable.
 */
export function lineOfPath(located, path) {
    const { doc, lineCounter } = located;
    if (path.length === 0)
        return null;
    const parent = path.length === 1 ? doc.contents : doc.getIn(path.slice(0, -1), true);
    const last = path[path.length - 1];
    if (isMap(parent)) {
        const pair = parent.items.find((p) => keyOf(p) === String(last));
        const key = pair?.key;
        if (key?.range)
            return lineCounter.linePos(key.range[0]).line;
    }
    const node = doc.getIn(path, true);
    if (node?.range)
        return lineCounter.linePos(node.range[0]).line;
    return null;
}
function keyOf(pair) {
    const k = pair.key;
    if (k === null || k === undefined)
        return '';
    if (typeof k === 'string')
        return k;
    return String(k.value);
}
