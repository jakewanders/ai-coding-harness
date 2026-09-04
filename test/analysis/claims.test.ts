import { describe, expect, it } from 'vitest';
import { claimsAudit } from '../../src/analysis/claims.js';

describe('claimsAudit', () => {
  it('extracts assertive sentences and says what each needs', () => {
    const text = [
      'This change always retries failed uploads.',
      'It fixes the redirect loop reported in the ticket.',
      'The button no longer renders twice on the settings page.',
      'Build is now faster and the check command passes.',
      'We refactored the helper for clarity.',
    ].join(' ');
    const claims = claimsAudit(text);
    expect(claims.map((c) => c.text)).toEqual([
      'This change always retries failed uploads.',
      'It fixes the redirect loop reported in the ticket.',
      'The button no longer renders twice on the settings page.',
    ]);
    expect(claims.map((c) => c.needs)).toEqual(['test', 'link', 'screenshot']);
  });

  it('handles bullets and the run category, and returns nothing for neutral prose', () => {
    const claims = claimsAudit('- Ensures the lint passes on CI\n- Covers the empty-cart case\n');
    expect(claims.map((c) => [c.text, c.needs])).toEqual([['Ensures the lint passes on CI', 'run'], ['Covers the empty-cart case', 'test']]);
    expect(claimsAudit('We changed some files. Please review.')).toEqual([]);
    expect(claimsAudit('')).toEqual([]);
  });
});
