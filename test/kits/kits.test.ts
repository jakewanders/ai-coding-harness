import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/load.js';
import { discoverKits, kitSearchPaths } from '../../src/kits/discover.js';
import { loadKit } from '../../src/kits/manifest.js';
import { selectDocs } from '../../src/kits/select.js';
import { dispatch } from '../../src/registry/tools.js';
import { STAGES } from '../../src/registry/stages.js';
import { systemTool } from '../../src/tools/system.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx, repoRoot } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';
import { makeTmpDir } from '../helpers/tmp.js';

const exampleKits = path.join(repoRoot, 'examples', 'kits');

function writeKit(root: string, name: string, yaml: string, docs: Record<string, string> = {}): string {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'kit.yaml'), yaml);
  for (const [rel, text] of Object.entries(docs)) fs.writeFileSync(path.join(dir, rel), text);
  return dir;
}

describe('discoverKits', () => {
  it('searches HARNESS_KIT_PATHS first, then ~/.harness/kits, then the plugin cache and the sibling kits repo; first hit wins', () => {
    const first = makeTmpDir('harness-kits-a');
    const second = makeTmpDir('harness-kits-b');
    writeKit(first, 'shared', 'gates:\n  impact_recorded: { severity: off }\n');
    writeKit(second, 'shared', 'gates:\n  impact_recorded: { severity: block }\n');
    writeKit(second, 'only-second', 'kits: []\n');
    const home = process.env.HARNESS_HOME!;
    const env = { HARNESS_KIT_PATHS: `${first}:${second}` };
    const kits = discoverKits(['shared', 'only-second', 'missing'], env, home, repoRoot);
    expect(kits.map((k) => [k.name, k.dir])).toEqual([['shared', path.join(first, 'shared')], ['only-second', path.join(second, 'only-second')]]);
    expect(kits[0]!.fragment.gates).toEqual({ impact_recorded: { severity: 'off' } });
    const paths = kitSearchPaths(env, home, '/plugins/cache/mkt/harness/1.0.0');
    expect(paths.slice(0, 2)).toEqual([first, second]);
    expect(paths[2]).toBe(path.join(home, '.harness', 'kits'));
    expect(paths.some((p) => p.includes('cache'))).toBe(true);
    expect(paths.at(-1)).toMatch(/ai-coding-harness-kits[\\/]kits$/);
    fs.mkdirSync(path.join(home, '.harness', 'kits'), { recursive: true });
    writeKit(path.join(home, '.harness', 'kits'), 'homekit', 'kits: []\n');
    expect(discoverKits(['homekit'], {}, home, repoRoot)[0]?.dir).toBe(path.join(home, '.harness', 'kits', 'homekit'));
  });
});

describe('example kit web-ui', () => {
  it('loads via HARNESS_KIT_PATHS with one doc, two rules and one gate override', () => {
    const [kit] = discoverKits(['web-ui'], { HARNESS_KIT_PATHS: exampleKits }, process.env.HARNESS_HOME!, repoRoot);
    expect(kit).toBeDefined();
    expect(kit!.name).toBe('web-ui');
    expect(kit!.docs).toHaveLength(1);
    expect(kit!.docs[0]).toMatchObject({ capabilities: ['browser_ui'] });
    expect(fs.existsSync(kit!.docs[0]!.path)).toBe(true);
    expect(kit!.rules.map((r) => r.id).sort()).toEqual(['no-any-type', 'no-hardcoded-hex']);
    expect(kit!.fragment.gates).toEqual({ walkthrough_done: { severity: 'block' } });
    expect(kit!.fragment.diffaudit?.rules).toHaveLength(2);
    const raw = parseYaml(fs.readFileSync(path.join(exampleKits, 'web-ui', 'kit.yaml'), 'utf8')) as { rules?: unknown };
    expect(raw.rules).toBeUndefined();
    expect(fs.existsSync(path.join(exampleKits, 'web-ui', 'rules.yaml'))).toBe(true);
  });

  it('rejects a kit whose fragment is invalid', () => {
    const root = makeTmpDir('harness-kits-bad');
    const dir = writeKit(root, 'bad', 'gates:\n  x: { severity: loud }\n');
    const r = loadKit(dir);
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error.path).toBe('gates.x.severity');
  });
});

describe('selectDocs', () => {
  it('selects by capability and by tag, absolute paths, no duplicates', () => {
    const root = makeTmpDir('harness-kits-docs');
    writeKit(root, 'k', ['docs:', '  - path: docs/ui.md', '    capabilities: [browser_ui]', '  - path: docs/api.md', '    tags: [api, backend]', '  - path: docs/both.md', '    tags: [api]', '    capabilities: [browser_ui]', ''].join('\n'), { 'docs/ui.md': 'ui', 'docs/api.md': 'api', 'docs/both.md': 'both' });
    const kits = discoverKits(['k'], { HARNESS_KIT_PATHS: root }, process.env.HARNESS_HOME!, repoRoot);
    expect(selectDocs(kits, { tags: [], capabilities: { browser_ui: true } })).toEqual([path.join(root, 'k', 'docs', 'ui.md'), path.join(root, 'k', 'docs', 'both.md')]);
    expect(selectDocs(kits, { tags: ['api'], capabilities: {} })).toEqual([path.join(root, 'k', 'docs', 'api.md'), path.join(root, 'k', 'docs', 'both.md')]);
    expect(selectDocs(kits, { tags: ['other'], capabilities: { browser_ui: false } })).toEqual([]);
  });
});

describe('config integration', () => {
  it('merges kit fragments below the user layer and lets user config override a kit gate override', async () => {
    const repo = makeRepo({ 'README.md': 'x', '.harness.yaml': 'schema: 1\nkits: [web-ui]\n' });
    const env = { ...process.env, HARNESS_KIT_PATHS: exampleKits };
    const merged = loadConfig({ cwd: repo, env });
    expect(merged.errors).toEqual([]);
    expect(merged.layers.filter((l) => l.name === 'kit')).toHaveLength(1);
    expect(merged.config.gates?.walkthrough_done).toEqual({ severity: 'block' });
    expect(merged.config.diffaudit?.rules?.map((r) => r.id).sort()).toEqual(['no-any-type', 'no-hardcoded-hex']);
    fs.writeFileSync(process.env.HARNESS_CONFIG!, 'schema: 1\ngates:\n  walkthrough_done: { severity: warn }\n');
    const overridden = loadConfig({ cwd: repo, env });
    expect(overridden.config.gates?.walkthrough_done).toEqual({ severity: 'warn' });
    const noKits = loadConfig({ cwd: makeRepo({ 'README.md': 'x' }), env });
    expect(noKits.layers.filter((l) => l.name === 'kit')).toHaveLength(0);
    expect(noKits.config.diffaudit?.rules).toEqual([]);
  });

  it('reports a missing kit as a config error instead of throwing', () => {
    const repo = makeRepo({ 'README.md': 'x', '.harness.yaml': 'schema: 1\nkits: [nope]\n' });
    const loaded = loadConfig({ cwd: repo, env: { ...process.env } });
    expect(loaded.errors.some((e) => e.path === 'kits' && /nope/.test(e.message))).toBe(true);
  });

  it('populates the header docs from the selected kit docs and system kits lists the kit', async () => {
    const repo = makeRepo({ 'README.md': 'x' });
    const probe = makeCtx({ cwd: repo, env: { ...process.env, HARNESS_KIT_PATHS: exampleKits } });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'KT-1' }, probe);
    const { readState } = await import('../../src/store/state.js');
    const { unitDirFor } = await import('../../src/store/units.js');
    const ns = readState(unitDirFor(probe, 'KT-1')).repo;
    fs.writeFileSync(path.join(repo, '.harness.yaml'), `schema: 1\nkits: [web-ui]\nrepos:\n  "${ns}":\n    capabilities:\n      browser_ui: true\n`);
    const ctx = makeCtx({ cwd: repo, env: { ...process.env, HARNESS_KIT_PATHS: exampleKits } });
    const brief = await dispatch(unitTool, { action: 'brief', id: 'KT-1', stage: 'build', quiet: true }, ctx);
    const header = parseYaml(/```yaml\n([\s\S]*?)\n```/.exec(brief.text)![1]!) as { docs: string[] };
    expect(header.docs).toEqual([path.join(exampleKits, 'web-ui', 'docs', 'ui-conventions.md')]);
    const kits = await dispatch(systemTool, { action: 'kits' }, ctx);
    expect(kits.envelope.ok).toBe(true);
    expect(kits.text).toContain('web-ui');
    expect(kits.envelope.data).toMatchObject({ kits: [{ name: 'web-ui', docs: 1, rules: 2 }] });
    const none = await dispatch(systemTool, { action: 'kits' }, makeCtx({ cwd: makeRepo({ 'README.md': 'x' }) }));
    expect(none.envelope.data).toMatchObject({ kits: [] });
  });

  it('still renders every stage with kits: []', async () => {
    const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x', '.harness.yaml': 'schema: 1\nkits: []\n' }) });
    await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'KT-2' }, ctx);
    for (const s of STAGES) {
      const input: Record<string, unknown> = { action: 'brief', stage: s.name, quiet: true };
      if (!(s.standalone && s.takesNoId)) input.id = 'KT-2';
      expect((await dispatch(unitTool, input, ctx)).envelope.ok, s.name).toBe(true);
    }
  });
});
