import { describe, expect, it } from 'vitest';
import { envelope, renderResponse, type Envelope } from '../../src/contracts/envelope.js';

describe('envelope', () => {
  it('stamps v: 1 and defaults next to []', () => {
    const env = envelope(true, 's', { a: 1 });
    expect(env).toEqual({ v: 1, ok: true, summary: 's', data: { a: 1 }, next: [] });
  });

  it('keeps next actions when given', () => {
    const next = [{ tool: 'unit', action: 'advance', why: 'gates pass' }];
    expect(envelope(false, 'blocked', null, next).next).toEqual(next);
  });
});

describe('renderResponse', () => {
  it('emits text, a blank line, then a fenced json block that round-trips', () => {
    const env: Envelope = envelope(true, 'ok', { items: [1, 2], name: 'x' }, [
      { tool: 'spec', action: 'context', why: 'read the requirement' },
    ]);
    const out = renderResponse('Hello there.', env);
    expect(out.startsWith('Hello there.\n\n```json\n')).toBe(true);
    expect(out.endsWith('\n```')).toBe(true);
    const m = /```json\n([\s\S]*?)\n```$/.exec(out);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1]!)).toEqual(env);
  });

  it('does not double the blank line when the text already ends with a newline', () => {
    const out = renderResponse('Line.\n', envelope(true, 's', {}));
    expect(out.startsWith('Line.\n\n```json\n')).toBe(true);
  });
});
