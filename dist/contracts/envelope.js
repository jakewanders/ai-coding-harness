/**
 * Result envelope. Every tool action response ends with this versioned JSON
 * block so callers can parse the outcome without reading the prose.
 */
export function envelope(ok, summary, data, next = []) {
    return { v: 1, ok, summary, data, next };
}
/** Human text, one blank line, then the envelope in a fenced json block. */
export function renderResponse(text, env) {
    const body = text.replace(/\n+$/, '');
    return `${body}\n\n\`\`\`json\n${JSON.stringify(env, null, 2)}\n\`\`\``;
}
