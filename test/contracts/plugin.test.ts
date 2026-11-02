import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../../src/index.js';
import { allTools } from '../../src/registry/index.js';
import { checkDist } from '../../src/scripts/check-dist.js';
import { listSkills } from '../../src/skills/inspect.js';
import { repoRoot } from '../helpers/ctx.js';

const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8')) as Record<string, unknown>;

describe('.claude-plugin/plugin.json', () => {
  const plugin = read('.claude-plugin/plugin.json') as { name: string; version: string; skills: string[]; hooks: string; mcpServers: Record<string, { command: string; args: string[] }> };
  const pkg = read('package.json') as { version: string };

  it('names the plugin and pins the version to package.json and VERSION', () => {
    expect(plugin.name).toBe('harness');
    expect(plugin.version).toBe(pkg.version);
    expect(plugin.version).toBe(VERSION);
  });

  it('declares every skill directory and every declared skill exists', () => {
    const dirs = listSkills(repoRoot).map((s) => `./skills/${s.name}`).sort();
    expect([...plugin.skills].sort()).toEqual(dirs);
    for (const rel of plugin.skills) expect(fs.existsSync(path.join(repoRoot, rel, 'SKILL.md')), rel).toBe(true);
  });

  it('points at existing hooks and server files', () => {
    expect(plugin.hooks).toBe('./hooks/hooks.json');
    expect(fs.existsSync(path.join(repoRoot, plugin.hooks))).toBe(true);
    const server = plugin.mcpServers.harness!;
    expect(server.command).toBe('node');
    expect(server.args).toEqual(['${CLAUDE_PLUGIN_ROOT}/dist/server.js']);
    expect(fs.existsSync(path.join(repoRoot, 'dist', 'server.js'))).toBe(true);
  });
});

describe('.claude-plugin/marketplace.json and .mcp.json', () => {
  it('lists the single plugin at ./ and the server entry references dist/server.js', () => {
    const market = read('.claude-plugin/marketplace.json') as { name: string; plugins: Array<{ name: string; source: string }> };
    expect(market.plugins).toHaveLength(1);
    expect(market.plugins[0]).toMatchObject({ name: 'harness', source: './' });
    const mcp = read('.mcp.json') as { mcpServers: Record<string, { command: string; args: string[] }> };
    expect(mcp.mcpServers.harness!.command).toBe('node');
    expect(mcp.mcpServers.harness!.args.join(' ')).toContain('dist/server.js');
  });
});

describe('README.md', () => {
  it('mentions every tool name and the main sections', () => {
    const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
    for (const t of allTools()) expect(readme, t.name).toMatch(new RegExp(`\\b${t.name}\\b`));
    for (const heading of ['Install', 'Quick start', 'Roles', 'Modes', 'Kits', 'Hooks', 'Configuration']) expect(readme).toMatch(new RegExp(`^##+ .*${heading}`, 'im'));
    expect(readme).toContain('docs/tools.md');
  });
});

describe('check:dist', () => {
  it('reports the committed dist as fresh and detects a stale file', () => {
    const fresh = checkDist(repoRoot);
    expect(fresh.differences).toEqual([]);
    expect(fresh.fresh).toBe(true);
    const target = path.join(repoRoot, 'dist', 'index.js');
    const original = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, original + '\n// stale\n');
    try {
      const stale = checkDist(repoRoot);
      expect(stale.fresh).toBe(false);
      expect(stale.differences.some((d) => d.includes('index.js'))).toBe(true);
    } finally {
      fs.writeFileSync(target, original);
    }
  });

  it('is wired as the check:dist script', () => {
    const pkg = read('package.json') as { scripts: Record<string, string> };
    expect(pkg.scripts['check:dist']).toBe('node dist/scripts/check-dist.js');
  });
});
