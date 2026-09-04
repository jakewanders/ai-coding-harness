import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/defaults.js';
import type { HarnessConfig } from '../../src/config/schema.js';
import { resolveMode } from '../../src/modes.js';
import { REVIEW_COLUMNS, requiredColumns } from '../../src/review/columns.js';
import { synthesize, type ReviewColumnRecord } from '../../src/review/synthesize.js';

const col = (column: string, findings: Array<{ severity: 'blocker' | 'major' | 'minor' | 'note'; text: string }> = []): ReviewColumnRecord => ({ column, findings });
const BASE = ['criteria_forward', 'criteria_reverse', 'architecture', 'security', 'tests', 'performance', 'diffaudit', 'ledger', 'adversarial'];
const all = BASE.map((c) => col(c));

describe('REVIEW_COLUMNS', () => {
  it('lists the thirteen spec columns with their capability requirements', () => {
    expect(REVIEW_COLUMNS.map((c) => c.id)).toEqual(['criteria_forward', 'criteria_reverse', 'architecture', 'security', 'tests', 'performance', 'component_library', 'accessibility', 'diffaudit', 'ledger', 'adversarial', 'counterweight', 'browser']);
    const req = Object.fromEntries(REVIEW_COLUMNS.map((c) => [c.id, c.requires ?? null]));
    expect(req.component_library).toBe('component_library');
    expect(req.accessibility).toBe('browser_ui');
    expect(req.browser).toBe('browser_ui');
    expect(req.counterweight).toBe('counterweight');
    expect(req.security).toBeNull();
  });

  it('derives the required set from capabilities, seat wiring and mode', () => {
    const thorough = resolveMode('thorough', DEFAULTS);
    expect(requiredColumns({ config: DEFAULTS, repo: 'local/x', mode: thorough })).toEqual(BASE);
    const ui: HarnessConfig = { ...DEFAULTS, repos: { 'local/x': { capabilities: { browser_ui: true, component_library: true } } } };
    expect(requiredColumns({ config: ui, repo: 'local/x', mode: thorough })).toEqual(expect.arrayContaining(['accessibility', 'browser', 'component_library']));
  });
});

describe('synthesize', () => {
  const cases: Array<[string, ReviewColumnRecord[], string[], string, Record<string, number>, string[]]> = [
    ['all clean ships', all, BASE, 'ship', { blocker: 0, major: 0, minor: 0, note: 0 }, []],
    ['minors and notes ship', [...all.slice(1), col('criteria_forward', [{ severity: 'minor', text: 'naming' }, { severity: 'note', text: 'fyi' }])], BASE, 'ship', { blocker: 0, major: 0, minor: 1, note: 1 }, []],
    ['a major needs attention', [...all.slice(1), col('criteria_forward', [{ severity: 'major', text: 'edge' }])], BASE, 'needs_attention', { blocker: 0, major: 1, minor: 0, note: 0 }, []],
    ['a blocker is not ready', [...all.slice(1), col('criteria_forward', [{ severity: 'blocker', text: 'AC-2 unmet' }, { severity: 'major', text: 'x' }])], BASE, 'not_ready', { blocker: 1, major: 1, minor: 0, note: 0 }, []],
    ['a missing required column is not ready', all.slice(1), BASE, 'not_ready', { blocker: 0, major: 0, minor: 0, note: 0 }, ['criteria_forward']],
    ['extra columns beyond the required set are fine', [...all, col('browser')], BASE, 'ship', { blocker: 0, major: 0, minor: 0, note: 0 }, []],
    ['no columns at all is not ready', [], BASE, 'not_ready', { blocker: 0, major: 0, minor: 0, note: 0 }, BASE],
  ];
  for (const [name, columns, required, verdict, counts, missing] of cases) {
    it(name, () => {
      expect(synthesize(columns, required)).toEqual({ verdict, counts, missing_columns: missing });
    });
  }
});
