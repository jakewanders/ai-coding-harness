import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import type { HarnessConfig } from '../../src/config/schema.js';
import { matchTicket, statusHint, ticketUrl } from '../../src/config/tickets.js';

const config: HarnessConfig = {
  ...DEFAULTS,
  tickets: [
    {
      pattern: '^ABC-\\d+$',
      repo: 'example.test/o/n',
      url: 'https://tracker.example.test/browse/{id}',
      status_hints: { scope: 'In Analysis', build: 'In Progress', publish: 'In Review' },
    },
    { pattern: '^XY\\d-\\d+$', repo: 'example.test/o/other' },
    { pattern: '(invalid', repo: 'broken' },
  ],
};

describe('matchTicket', () => {
  it('returns the first rule whose pattern matches', () => {
    expect(matchTicket('ABC-12', config)?.repo).toBe('example.test/o/n');
    expect(matchTicket('XY9-1', config)?.repo).toBe('example.test/o/other');
  });

  it('returns null for no match, invalid patterns, or no rules', () => {
    expect(matchTicket('ZZZ-1', config)).toBeNull();
    expect(matchTicket('local-1a2b3c4d', config)).toBeNull();
    expect(matchTicket('ABC-12', DEFAULTS)).toBeNull();
    expect(matchTicket('ABC-12', { ...DEFAULTS, tickets: undefined })).toBeNull();
  });
});

describe('ticketUrl', () => {
  it('fills the {id} template and encodes the id', () => {
    expect(ticketUrl('ABC-12', config)).toBe('https://tracker.example.test/browse/ABC-12');
    expect(ticketUrl('ABC-12', { ...DEFAULTS, tickets: [{ pattern: '.*', url: 'https://t.example.test/?q={id}&x={id}' }] })).toBe(
      'https://t.example.test/?q=ABC-12&x=ABC-12',
    );
  });

  it('returns null when the rule has no url or nothing matches', () => {
    expect(ticketUrl('XY9-1', config)).toBeNull();
    expect(ticketUrl('ZZZ-1', config)).toBeNull();
  });
});

describe('statusHint', () => {
  it('returns the hint for a boundary and null when missing or unmatched', () => {
    expect(statusHint('ABC-12', 'scope', config)).toBe('In Analysis');
    expect(statusHint('ABC-12', 'build', config)).toBe('In Progress');
    expect(statusHint('ABC-12', 'close', config)).toBeNull();
    expect(statusHint('XY9-1', 'scope', config)).toBeNull();
    expect(statusHint('ZZZ-1', 'scope', config)).toBeNull();
  });
});
