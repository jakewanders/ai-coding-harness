import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../src/config/defaults.js';
import type { HarnessConfig } from '../src/config/schema.js';
import { BUILT_IN_MODES, UnknownModeError, demotionsOf, resolveMode } from '../src/modes.js';

describe('resolveMode', () => {
  it('thorough uses defaults', () => {
    const m = resolveMode('thorough', DEFAULTS);
    expect(m).toEqual({ name: 'thorough', extends: null, demote: {}, merge_dispatches: false, verify_after_publish: false, skip_stages: [], banner: null });
  });

  it('sketch skips review and verify and carries a banner', () => {
    const m = resolveMode('sketch', DEFAULTS);
    expect(m.skip_stages).toEqual(expect.arrayContaining(['review', 'verify']));
    expect(m.banner).toMatch(/nothing reviewed/i);
    expect(m.demote.review_verdict_ship).toBe('off');
    expect(m.merge_dispatches).toBe(false);
    expect(m.verify_after_publish).toBe(false);
  });

  it('resolves a custom mode extending sketch and inheriting its demotions', () => {
    const config: HarnessConfig = { ...DEFAULTS, modes: { fast: { extends: 'sketch', demote: { pii_audit_clean: 'warn' } } } };
    const m = resolveMode('fast', config);
    expect(m.name).toBe('fast');
    expect(m.extends).toBe('sketch');
    expect(m.demote).toMatchObject({ review_verdict_ship: 'off', pii_audit_clean: 'warn' });
    expect(m.skip_stages).toEqual(expect.arrayContaining(['review', 'verify']));
    expect(m.merge_dispatches).toBe(false);
  });

  it('defaults a custom mode without extends to thorough and lets config override a built-in', () => {
    const config: HarnessConfig = { ...DEFAULTS, modes: { mine: { demote: { ledger_reverified: 'off' } }, sketch: { demote: { pii_audit_clean: 'warn' } } } };
    expect(resolveMode('mine', config)).toMatchObject({ extends: 'thorough', demote: { ledger_reverified: 'off' }, merge_dispatches: false });
    expect(resolveMode('sketch', config).demote).toMatchObject({ review_verdict_ship: 'off', pii_audit_clean: 'warn' });
    expect(resolveMode('sketch', config).skip_stages).toEqual(expect.arrayContaining(['review', 'verify']));
  });

  it('throws for an unknown mode and for a cycle', () => {
    expect(() => resolveMode('nope', DEFAULTS)).toThrow(UnknownModeError);
    const config: HarnessConfig = { ...DEFAULTS, modes: { a: { extends: 'b' }, b: { extends: 'a' } } };
    expect(() => resolveMode('a', config)).toThrow(/cycle/);
  });

  it('exposes the two built-in mode names', () => {
    expect(Object.keys(BUILT_IN_MODES)).toEqual(['thorough', 'sketch']);
  });
});

describe('demotionsOf', () => {
  it('lists real demotions and drops attempted promotions', () => {
    const m = { ...resolveMode('sketch', DEFAULTS), demote: { reach_audit_recorded: 'warn' as const, impact_recorded: 'block' as const, ledger_reverified: 'off' as const } };
    expect(demotionsOf(m)).toEqual([
      { gate: 'ledger_reverified', to: 'off' },
      { gate: 'reach_audit_recorded', to: 'warn' },
    ]);
    expect(demotionsOf(resolveMode('thorough', DEFAULTS))).toEqual([]);
  });
});
