import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UnknownSchemaError, migrate } from '../../src/store/migrations.js';
import { STATE_SCHEMA, readState } from '../../src/store/state.js';
import { makeTmpDir } from '../helpers/tmp.js';

const schema0 = {
  schema: 0,
  id: 'OLD-9',
  repo: 'local/proj',
  tracked: true,
  source: { kind: 'ticket', ref: 'OLD-9', pinned: true },
  mode: 'express',
  phaseName: 'commit', // harness-lint: allow
  cycle: 2,
  base_branch: 'develop',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-02T00:00:00.000Z',
};

describe('migrate', () => {
  it('lifts a schema-0 fixture to the current schema, renaming the stage field', () => {
    const s = migrate(schema0);
    expect(s.schema).toBe(STATE_SCHEMA);
    expect(s.stage).toBe('build');
    expect(s.cycle).toBe(2);
    for (const [old, now] of [['plan', 'build'], ['revise', 'build'], ['challenge', 'review'], ['review', 'review']]) {
      expect(migrate({ ...schema0, phaseName: old }).stage, old).toBe(now); // harness-lint: allow
    }
    const current = migrate(schema0);
    const renamed = migrate({ ...current, stage: 'commit', timers: [{ stage: 'plan', started_at: '2025-01-01T00:00:00.000Z', ended_at: null, idle_gaps_ms: 0 }] });
    expect(renamed.stage).toBe('build');
    expect(renamed.timers[0]!.stage).toBe('build');
    expect(s.mode).toBe('express');
    expect(s.base_branch).toBe('develop');
    expect(s.evidence).toEqual([]);
    expect(s.challenge_passed).toBe(false);
    expect(s.created_at).toBe('2025-01-01T00:00:00.000Z');
    expect('phaseName' in s).toBe(false); // harness-lint: allow
  });

  it('returns a current-schema state unchanged', () => {
    const s = migrate(schema0);
    expect(migrate(s)).toEqual(s);
  });

  it('throws UnknownSchemaError for unknown or future schemas', () => {
    expect(() => migrate({ ...schema0, schema: 99 })).toThrow(UnknownSchemaError);
    expect(() => migrate({ ...schema0, schema: 'x' })).toThrow(UnknownSchemaError);
    expect(() => migrate(null)).toThrow(UnknownSchemaError);
  });

  it('rejects a migrated state that is still invalid', () => {
    expect(() => migrate({ ...schema0, phaseName: 'nowhere' })).toThrow(); // harness-lint: allow
  });
});

describe('readState migration', () => {
  it('reads a schema-0 file, returns schema 1, and rewrites the file', () => {
    const dir = makeTmpDir('harness-migrate');
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(schema0));
    const s = readState(dir);
    expect(s.schema).toBe(STATE_SCHEMA);
    expect(s.stage).toBe('build');
    const rewritten = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    expect(rewritten.schema).toBe(STATE_SCHEMA);
    expect(rewritten.stage).toBe('build');
    expect(rewritten.phaseName).toBeUndefined(); // harness-lint: allow
  });
});
