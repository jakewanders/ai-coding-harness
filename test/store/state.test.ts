import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STATE_SCHEMA,
  appendHistory,
  createState,
  readState,
  writeState,
  type UnitState,
} from '../../src/store/state.js';
import { makeTmpDir } from '../helpers/tmp.js';

function init() {
  return {
    id: 'ABC-1',
    repo: 'local/proj',
    tracked: true,
    source: { kind: 'ticket' as const, ref: 'ABC-1', pinned: false },
    mode: 'thorough',
    base_branch: 'main',
  };
}

describe('createState', () => {
  it('starts at define, cycle 0, challenge not passed, with empty collections', () => {
    const s = createState(init());
    expect(s.schema).toBe(STATE_SCHEMA);
    expect(s.stage).toBe('define');
    expect(s.cycle).toBe(0);
    expect(s.challenge_passed).toBe(false);
    expect(s.kind).toBe('unknown');
    expect(s.worktree).toBeNull();
    expect(s.branch).toBeNull();
    expect(s.pr).toBeNull();
    expect(s.evidence).toEqual([]);
    expect(s.commits).toEqual([]);
    expect(s.runs).toEqual([]);
    expect(s.timers).toEqual([]);
    expect(s.answers).toEqual({});
    expect(s.created_at).toBe(s.updated_at);
    expect(() => new Date(s.created_at).toISOString()).not.toThrow();
  });
});

describe('writeState / readState', () => {
  it('round-trips and serializes the worktree home-relative', () => {
    const dir = makeTmpDir('harness-state');
    const home = process.env.HARNESS_HOME!;
    const s: UnitState = { ...createState(init()), worktree: path.join(home, 'code', 'proj-ABC-1'), branch: 'ABC-1' };
    writeState(dir, s);
    const raw = fs.readFileSync(path.join(dir, 'state.json'), 'utf8');
    expect(raw).not.toContain(home);
    expect(raw).toContain('~/code/proj-ABC-1');
    const back = readState(dir);
    const { updated_at: _a, ...expected } = s;
    const { updated_at: _b, ...actual } = back;
    expect(actual).toEqual(expected);
  });

  it('rejects an invalid state on write', () => {
    const dir = makeTmpDir('harness-state');
    const bad = { ...createState(init()), stage: 'nowhere' } as unknown as UnitState;
    expect(() => writeState(dir, bad)).toThrow();
    expect(fs.existsSync(path.join(dir, 'state.json'))).toBe(false);
  });

  it('bumps updated_at on write and keeps created_at', () => {
    const dir = makeTmpDir('harness-state');
    const s = createState(init());
    const created = s.created_at;
    writeState(dir, { ...s, created_at: '2020-01-01T00:00:00.000Z', updated_at: '2020-01-01T00:00:00.000Z' });
    const back = readState(dir);
    expect(back.created_at).toBe('2020-01-01T00:00:00.000Z');
    expect(back.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
    expect(new Date(back.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(created).getTime());
  });
});

describe('appendHistory', () => {
  it('appends timestamped bullet lines and preserves earlier ones', () => {
    const dir = makeTmpDir('harness-state');
    appendHistory(dir, 'unit started');
    appendHistory(dir, 'advanced to plan');
    const lines = fs.readFileSync(path.join(dir, 'history.md'), 'utf8').trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^- \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z unit started$/);
    expect(lines[1]).toMatch(/ advanced to plan$/);
  });
});
