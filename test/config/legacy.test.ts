import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/load.js';
import { statusHint } from '../../src/config/tickets.js';
import { upgradeLegacyConfig } from '../../src/config/legacy.js';
import { resolveMode } from '../../src/modes.js';
import { makeTmpDir } from '../helpers/tmp.js';

function repoWith(yaml: string): string {
  const root = makeTmpDir('harness-legacy');
  fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(root, '.harness.yaml'), yaml);
  return root;
}

describe('upgradeLegacyConfig', () => {
  it('renames old stage ids in status_hints, custom_gates and the mode flag, with one note each', () => {
    const { raw, notes } = upgradeLegacyConfig({
      tickets: [{ pattern: '^A-', status_hints: { scope: 'S', build: 'B', publish: 'P', close: 'C' } }],
      custom_gates: [{ id: 'g', stage: 'publish', command: 'true' }, { id: 'h', stage: 'review', command: 'true' }],
      modes: { m: { verify_after_publish: true } },
    });
    expect((raw.tickets as Array<{ status_hints: object }>)[0]!.status_hints).toEqual({ define: 'S', build: 'B', pr: 'P', wrap_up: 'C' });
    expect((raw.custom_gates as Array<{ stage: string }>).map((g) => g.stage)).toEqual(['pr', 'review']);
    expect(raw.modes).toEqual({ m: { walkthrough_after_pr: true } });
    expect(notes).toHaveLength(5);
  });

  it('prefers the new key when both are present', () => {
    const { raw } = upgradeLegacyConfig({ tickets: [{ pattern: 'x', status_hints: { scope: 'old', define: 'new' } }] });
    expect((raw.tickets as Array<{ status_hints: object }>)[0]!.status_hints).toEqual({ define: 'new' });
  });
});

describe('loadConfig with deprecated stage ids', () => {
  it('accepts the old spelling, reports deprecations and applies the values', () => {
    const root = repoWith('schema: 1\ntickets:\n  - pattern: "^OLD-\\\\d+$"\n    status_hints:\n      scope: "In Analysis"\n      close: "Done"\nmodes:\n  careful:\n    verify_after_publish: true\n');
    const loaded = loadConfig({ cwd: root });
    expect(loaded.errors).toEqual([]);
    expect(loaded.deprecations?.length).toBe(3);
    expect(loaded.deprecations!.join('\n')).toMatch(/"scope" is deprecated, use "define"/);
    expect(statusHint('OLD-1', 'define', loaded.config)).toBe('In Analysis');
    expect(statusHint('OLD-1', 'wrap_up', loaded.config)).toBe('Done');
    expect(resolveMode('careful', loaded.config).walkthrough_after_pr).toBe(true);
  });

  it('reports no deprecations for the new spelling', () => {
    const root = repoWith('schema: 1\ntickets:\n  - pattern: "^NEW-"\n    status_hints:\n      define: "In Analysis"\n');
    const loaded = loadConfig({ cwd: root });
    expect(loaded.errors).toEqual([]);
    expect(loaded.deprecations).toBeUndefined();
  });
});
