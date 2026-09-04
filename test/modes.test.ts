import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../src/config/defaults.js';
import type { HarnessConfig } from '../src/config/schema.js';
import { BUILT_IN_MODES, UnknownModeError, demotionsOf, resolveMode } from '../src/modes.js';

describe('resolveMode', () => {
  it('thorough uses defaults', () => {
    const m = resolveMode('thorough', DEFAULTS);
    expect(m).toEqual({ name: 'thorough', extends: null, demote: {}, merge_dispatches: false, verify_after_publish: false, skip_stages: [], banner: null });
  });

  it('express demotes reach audit and counterweight, merges dispatches, verifies after publish', () => {
    const m = resolveMode('express', DEFAULTS);
    expect(m.demote).toMatchObject({ reach_audit_recorded: 'warn', counterweight_consulted: 'warn' });
    expect(m.merge_dispatches).toBe(true);
    expect(m.verify_after_publish).toBe(true);
    expect(m.skip_stages).toEqual([]);
  });

  it('sketch skips review, challenge and verify and carries a banner', () => {
    const m = resolveMode('sketch', DEFAULTS);
    expect(m.skip_stages).toEqual(expect.arrayContaining(['review', 'challenge', 'verify']));
    expect(m.banner).toMatch(/nothing reviewed/i);
    expect(m.demote.review_verdict_ship).toBe('off');
    expect(m.demote.challenge_passed).toBe('off');
  });

  it('resolves a custom mode extending express and inheriting its demotions', () => {
    const config: HarnessConfig = { ...DEFAULTS, modes: { fast: { extends: 'express', demote: { pii_audit_clean: 'warn' }, verify_after_publish: false } } };
    const m = resolveMode('fast', config);
    expect(m.name).toBe('fast');
    expect(m.extends).toBe('express');
    expect(m.demote).toMatchObject({ reach_audit_recorded: 'warn', counterweight_consulted: 'warn', pii_audit_clean: 'warn' });
    expect(m.merge_dispatches).toBe(true);
    expect(m.verify_after_publish).toBe(false);
  });

  it('defaults a custom mode without extends to thorough and lets config override a built-in', () => {
    const config: HarnessConfig = { ...DEFAULTS, modes: { mine: { demote: { impact_recorded: 'off' } }, express: { verify_after_publish: false } } };
    expect(resolveMode('mine', config)).toMatchObject({ extends: 'thorough', demote: { impact_recorded: 'off' }, merge_dispatches: false });
    expect(resolveMode('express', config).verify_after_publish).toBe(false);
    expect(resolveMode('express', config).merge_dispatches).toBe(true);
  });

  it('throws for an unknown mode and for a cycle', () => {
    expect(() => resolveMode('nope', DEFAULTS)).toThrow(UnknownModeError);
    const config: HarnessConfig = { ...DEFAULTS, modes: { a: { extends: 'b' }, b: { extends: 'a' } } };
    expect(() => resolveMode('a', config)).toThrow(/cycle/);
  });

  it('exposes the three built-in mode names', () => {
    expect(Object.keys(BUILT_IN_MODES)).toEqual(['thorough', 'express', 'sketch']);
  });
});

describe('demotionsOf', () => {
  it('lists real demotions and drops attempted promotions', () => {
    const m = { ...resolveMode('express', DEFAULTS), demote: { reach_audit_recorded: 'warn' as const, impact_recorded: 'block' as const, ledger_reverified: 'off' as const } };
    expect(demotionsOf(m)).toEqual([
      { gate: 'ledger_reverified', to: 'off' },
      { gate: 'reach_audit_recorded', to: 'warn' },
    ]);
    expect(demotionsOf(resolveMode('thorough', DEFAULTS))).toEqual([]);
  });
});
