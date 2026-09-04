/**
 * Result envelope. Every tool action response ends with this versioned JSON
 * block so callers can parse the outcome without reading the prose.
 */

export interface NextAction {
  tool: string;
  action: string;
  why: string;
}

export interface Envelope<T = unknown> {
  v: 1;
  ok: boolean;
  summary: string;
  data: T;
  next: NextAction[];
}

export function envelope<T>(ok: boolean, summary: string, data: T, next: NextAction[] = []): Envelope<T> {
  return { v: 1, ok, summary, data, next };
}

/** Human text, one blank line, then the envelope in a fenced json block. */
export function renderResponse(text: string, env: Envelope): string {
  const body = text.replace(/\n+$/, '');
  return `${body}\n\n\`\`\`json\n${JSON.stringify(env, null, 2)}\n\`\`\``;
}
