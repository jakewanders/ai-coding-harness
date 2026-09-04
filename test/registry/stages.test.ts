import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/load.js';
import { BRIEF_CONTRACT, type BriefHeader } from '../../src/contracts/header.js';
import { CORE_ORDER, FLOW_NAMES, STAGES, nextStageFor, stageEntry, type BriefContext } from '../../src/registry/stages.js';
import type { StageName } from '../../src/store/state.js';
import { makeTmpDir } from '../helpers/tmp.js';

function emptyContext(): BriefContext {
  const header: BriefHeader = {
    contract: BRIEF_CONTRACT, unit: 'local-00000000', mode: 'thorough', stage: 'scope', repo: 'local/x',
    worktree: null, base_branch: 'main', root: '/root',
    seats: { tracker: 'unwired', codehost: 'unwired', docs: 'unwired', design: 'unwired', chat: 'unwired', reviewbot: 'unwired' },
    capabilities: {}, gates: [], docs: [], config_errors: [],
  };
  return { state: null, config: loadConfig({ cwd: makeTmpDir('harness-nogit'), env: process.env }), header, vault: '/vault', root: '/root', quiet: false, unitDir: null };
}

describe('STAGES', () => {
  it('holds the six core stages in order plus the standalone flows', () => {
    expect(CORE_ORDER).toEqual(['scope', 'build', 'review', 'verify', 'publish', 'close']);
    expect(STAGES).toHaveLength(6 + FLOW_NAMES.length);
    expect(STAGES.slice(0, 6).map((s) => s.name)).toEqual(CORE_ORDER);
    expect(STAGES.slice(0, 6).every((s) => s.standalone === false)).toBe(true);
    const flows = STAGES.slice(6);
    expect(flows.map((s) => s.name)).toEqual([...FLOW_NAMES]);
    expect(flows.every((s) => s.standalone === true)).toBe(true);
    expect(new Set(STAGES.map((s) => s.name)).size).toBe(STAGES.length);
  });

  it('looks up entries by name', () => {
    expect(stageEntry('build')?.name).toBe('build');
    expect(stageEntry('pilot')?.standalone).toBe(true);
    expect(stageEntry('setup')?.takesNoId).toBe(true);
    expect(stageEntry('nope')).toBeUndefined();
  });

  it('renders every entry on empty config with no unit', () => {
    const ctx = emptyContext();
    for (const s of STAGES) {
      const out = s.render({ ...ctx, header: { ...ctx.header, stage: s.name } });
      expect(typeof out, s.name).toBe('string');
      expect(out.trim().length, s.name).toBeGreaterThan(0);
    }
  });
});

describe('nextStageFor', () => {
  const t = (c: StageName, skip: StageName[], ui: boolean) => nextStageFor(c, { skip, browserUi: ui });
  it('routes the lean pipeline', () => {
    expect(t('scope', [], false)).toBe('build');
    expect(t('build', [], false)).toBe('review');
    expect(t('review', [], false)).toBe('publish');
    expect(t('review', [], true)).toBe('verify');
    expect(t('verify', [], true)).toBe('publish');
    expect(t('publish', [], false)).toBe('close');
    expect(t('close', [], false)).toBeNull();
    expect(t('build', ['review', 'verify'], true)).toBe('publish');
  });
});
