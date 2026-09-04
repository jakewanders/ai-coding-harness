import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../helpers/ctx.js';
import { makeTmpDir } from '../helpers/tmp.js';

const guard = path.join(repoRoot, 'hooks', 'guard.mjs');

function run(args: string[], payload: unknown, env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, [guard, ...args], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('hooks.json', () => {
  it('binds PreToolUse Bash and Stop to the guard bootstrap', () => {
    const hooks = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hooks', 'hooks.json'), 'utf8')) as { hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; command: string }> }>> };
    const pre = hooks.hooks.PreToolUse!;
    expect(pre[0]!.matcher).toBe('Bash');
    expect(pre[0]!.hooks[0]!.command).toBe('node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs" pre-bash');
    expect(hooks.hooks.Stop![0]!.hooks[0]!.command).toBe('node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs" stop_status');
  });
});

describe('guard.mjs bootstrap without a build', () => {
  const missing = path.join(makeTmpDir('harness-hook'), 'missing', 'index.js');

  it('blocks git commit, git push and PR creation with build instructions (exit 2)', () => {
    for (const command of ['git commit -m x', 'git push origin main', 'gh pr create', 'glab merge-request create']) {
      const r = run(['pre-bash'], { tool_input: { command }, cwd: '/tmp' }, { HARNESS_HOOK_IMPL: missing });
      expect(r.status, command).toBe(2);
      expect(r.stdout + r.stderr, command).toContain('npm install && npm run build');
    }
  });

  it('lets everything else pass with a warning (exit 0)', () => {
    for (const command of ['ls', 'npm install && npm run build', 'git status']) {
      const r = run(['pre-bash'], { tool_input: { command }, cwd: '/tmp' }, { HARNESS_HOOK_IMPL: missing });
      expect(r.status, command).toBe(0);
      expect(r.stdout + r.stderr, command).toMatch(/not built|unbuilt|warning/i);
    }
    const stop = run(['stop_status'], { cwd: '/tmp' }, { HARNESS_HOOK_IMPL: missing });
    expect(stop.status).toBe(0);
  });
});

describe('guard.mjs bootstrap with an implementation', () => {
  it('dispatches to runHook from the module named by HARNESS_HOOK_IMPL', () => {
    const impl = path.join(makeTmpDir('harness-hook-impl'), 'impl.mjs');
    fs.writeFileSync(impl, "export async function runHook(guard, payload) { return { exit: guard === 'pre-bash' && payload.tool_input.command === 'git commit -m x' ? 2 : 0, stdout: JSON.stringify({ seen: guard, command: payload.tool_input?.command ?? null }) + '\\n', stderr: '' }; }\n");
    const blocked = run(['pre-bash'], { tool_input: { command: 'git commit -m x' }, cwd: '/tmp' }, { HARNESS_HOOK_IMPL: impl });
    expect(blocked.status).toBe(2);
    expect(JSON.parse(blocked.stdout)).toEqual({ seen: 'pre-bash', command: 'git commit -m x' });
    const fine = run(['stop_status'], { cwd: '/tmp' }, { HARNESS_HOOK_IMPL: impl });
    expect(fine.status).toBe(0);
    expect(JSON.parse(fine.stdout)).toEqual({ seen: 'stop_status', command: null });
  });

  it('runs against the committed build for a harmless command', () => {
    const r = run(['pre-bash'], { tool_input: { command: 'ls' }, cwd: process.env.HARNESS_HOME! });
    expect(r.status).toBe(0);
  });
});
