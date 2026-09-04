import { describe, expect, it } from 'vitest';
import { branchNameFor, isTrackerId, slugify, syntheticId, unitFromBranch } from '../../src/store/ids.js';

describe('isTrackerId', () => {
  it('accepts the tracker form and rejects everything else', () => {
    for (const ok of ['ABC-1', 'AB2-123', 'X9-7']) expect(isTrackerId(ok), ok).toBe(true);
    for (const bad of ['abc-1', 'A-1', 'ABC1', 'ABC-', 'ABC-1x', '1BC-2', 'ABC-1-2', '', ' ABC-1', 'local-1234abcd']) {
      expect(isTrackerId(bad), bad).toBe(false);
    }
  });
});

describe('syntheticId', () => {
  it('is local- plus 8 hex, stable for equal text, different for different text', () => {
    const a = syntheticId('fix the login redirect');
    expect(a).toMatch(/^local-[0-9a-f]{8}$/);
    expect(syntheticId('fix the login redirect')).toBe(a);
    expect(syntheticId('fix the logout redirect')).not.toBe(a);
    expect(syntheticId('')).toMatch(/^local-[0-9a-f]{8}$/);
  });
});

describe('unitFromBranch', () => {
  it('extracts the first tracker-form token', () => {
    expect(unitFromBranch('feat/ABC-12-login')).toBe('ABC-12');
    expect(unitFromBranch('ABC-12')).toBe('ABC-12');
    expect(unitFromBranch('jake/XY9-7_thing')).toBe('XY9-7');
    expect(unitFromBranch('fix/ABC-12-then-DEF-3')).toBe('ABC-12');
  });

  it('falls back to an exact known id and otherwise returns null', () => {
    expect(unitFromBranch('local-1a2b3c4d', ['local-1a2b3c4d'])).toBe('local-1a2b3c4d');
    expect(unitFromBranch('feature/local-1a2b3c4d-thing', ['local-1a2b3c4d'])).toBe('local-1a2b3c4d');
    expect(unitFromBranch('main', ['local-1a2b3c4d'])).toBeNull();
    expect(unitFromBranch('feature/abc-12-lower')).toBeNull();
    expect(unitFromBranch('')).toBeNull();
  });
});

describe('slugify', () => {
  it('lowercases, strips punctuation, collapses separators', () => {
    expect(slugify('Fix the Login  Redirect!')).toBe('fix-the-login-redirect');
    expect(slugify('  --Leading & trailing--  ')).toBe('leading-trailing');
    expect(slugify('Ünïcödé façade')).toBe('unicode-facade');
    expect(slugify('')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
});

describe('branchNameFor', () => {
  it('joins id and slug, trims to 60 chars without a trailing dash', () => {
    expect(branchNameFor('ABC-12', 'Fix the login redirect')).toBe('ABC-12-fix-the-login-redirect');
    const long = branchNameFor('ABC-12', 'a'.repeat(30) + ' ' + 'b'.repeat(40));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.startsWith('ABC-12-')).toBe(true);
    expect(long.endsWith('-')).toBe(false);
    expect(branchNameFor('ABC-12', '')).toBe('ABC-12');
    expect(branchNameFor('ABC-12', '???')).toBe('ABC-12');
  });
});
