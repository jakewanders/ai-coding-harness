import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHostPayload, renderDecision } from '../../src/hooks/adapter.js';
import { runPreBash, runStop, type GuardDeps } from '../../src/hooks/guards.js';
import { resolveUnit } from '../../src/hooks/resolve-unit.js';
import { dispatch } from '../../src/registry/tools.js';
import { readState, writeState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo, runGit } from '../helpers/git.js';

function deps(over: Partial<GuardDeps> = {}): GuardDeps {
  return { env: { ...process.env }, now: () => new Date('2026-09-04T12:00:00.000Z'), ...over };
}

async function repoWithUnit(branch = 'ABC-1-x') {
  const repo = makeRepo({ 'README.md': 'x\n' });
  const ctx = makeCtx({ cwd: repo });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: 'ABC-1' }, ctx);
  const dir = unitDirFor(ctx, 'ABC-1');
  writeState(dir, { ...readState(dir), stage: 'commit', branch });
  runGit(['checkout', '-q', '-b', branch], repo);
  return { repo, ctx, dir };
}

function stage(repo: string, rel: string, content: string | Buffer) {
  fs.writeFileSync(path.join(repo, rel), content);
  runGit(['add', rel], repo);
}

describe('adapter', () => {
  it('parses PreToolUse and Stop payloads', () => {
    expect(parseHostPayload(JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' }, cwd: '/w' }))).toEqual({ event: 'pre-bash', command: 'git status', cwd: '/w' });
    expect(parseHostPayload(JSON.stringify({ hook_event_name: 'Stop', cwd: '/w' }))).toEqual({ event: 'stop', cwd: '/w' });
    expect(parseHostPayload('not json').event).toBe('pre-bash');
  });

  it('renders a block as a deny decision with exit 2 and a pass as a warning with exit 0', () => {
    const block = renderDecision(true, 'nope');
    expect(block.exit).toBe(2);
    expect(JSON.parse(block.stdout)).toMatchObject({ decision: 'block', reason: 'nope' });
    const pass = renderDecision(false, 'fyi');
    expect(pass.exit).toBe(0);
    expect(JSON.parse(pass.stdout)).toMatchObject({ systemMessage: 'fyi' });
    expect(renderDecision(false, '').stdout).toBe('');
  });
});

describe('resolveUnit', () => {
  it('finds the unit from the branch name and returns null otherwise', async () => {
    const { repo, ctx } = await repoWithUnit();
    expect(resolveUnit(repo, ctx.vault)?.id).toBe('ABC-1');
    runGit(['checkout', '-q', 'main'], repo);
    expect(resolveUnit(repo, ctx.vault)).toBeNull();
  });
});

describe('no_bypass_flags', () => {
  it('blocks bypass flags on commit and force pushes without lease', async () => {
    const repo = makeRepo({ 'a': '1' });
    for (const cmd of ['git commit --no-verify -m x', 'git commit -m x --no-gpg-sign', 'git push --force origin main', 'git push -f']) {
      const r = await runPreBash({ event: 'pre-bash', command: cmd, cwd: repo }, deps());
      expect(r.block, cmd).toBe(true);
      expect(r.guards.find((g) => g.id === 'no_bypass_flags')?.outcome, cmd).toBe('block');
    }
    for (const cmd of ['git commit -m x', 'git push --force-with-lease origin ABC-1-x', 'ls -la', 'npm test']) {
      const r = await runPreBash({ event: 'pre-bash', command: cmd, cwd: repo }, deps());
      expect(r.guards.find((g) => g.id === 'no_bypass_flags')?.outcome, cmd).not.toBe('block');
    }
  });
});

describe('protected_branch', () => {
  it('blocks pushes to protected branches unless overridden', async () => {
    const repo = makeRepo({ 'a': '1' });
    const blocked = await runPreBash({ event: 'pre-bash', command: 'git push origin main', cwd: repo }, deps());
    expect(blocked.guards.find((g) => g.id === 'protected_branch')?.outcome).toBe('block');
    const release = await runPreBash({ event: 'pre-bash', command: 'git push origin release/2.0', cwd: repo }, deps());
    expect(release.guards.find((g) => g.id === 'protected_branch')?.outcome).toBe('block');
    const current = await runPreBash({ event: 'pre-bash', command: 'git push', cwd: repo }, deps());
    expect(current.guards.find((g) => g.id === 'protected_branch')?.outcome).toBe('block');
    const feature = await runPreBash({ event: 'pre-bash', command: 'git push origin ABC-1-x', cwd: repo }, deps());
    expect(feature.guards.find((g) => g.id === 'protected_branch')?.outcome).toBe('pass');
    const env = await runPreBash({ event: 'pre-bash', command: 'git push origin main', cwd: repo }, deps({ env: { ...process.env, HARNESS_ALLOW_PROTECTED: '1' } }));
    expect(env.guards.find((g) => g.id === 'protected_branch')?.outcome).toBe('warn');
    const escape = await runPreBash({ event: 'pre-bash', command: 'git push origin main # harness: allow-protected', cwd: repo }, deps());
    expect(escape.guards.find((g) => g.id === 'protected_branch')?.outcome).toBe('warn');
  });
});

describe('credential_scan and oversize_file', () => {
  it('blocks a staged secret and a staged 6 MB file, passes clean stages', async () => {
    const repo = makeRepo({ 'a': '1' });
    const clean = await runPreBash({ event: 'pre-bash', command: 'git commit -m x', cwd: repo }, deps());
    expect(clean.guards.find((g) => g.id === 'credential_scan')?.outcome).toBe('pass');
    expect(clean.guards.find((g) => g.id === 'oversize_file')?.outcome).toBe('pass');
    stage(repo, 'config.js', "const api_key = 'sk_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e';\n");
    const secret = await runPreBash({ event: 'pre-bash', command: 'git commit -m x', cwd: repo }, deps());
    expect(secret.block).toBe(true);
    expect(secret.guards.find((g) => g.id === 'credential_scan')?.outcome).toBe('block');
    expect(secret.messages.join('\n')).toContain('config.js');
    runGit(['reset', '-q', 'config.js'], repo);
    stage(repo, 'key.pem', '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----\n');
    expect((await runPreBash({ event: 'pre-bash', command: 'git commit -m x', cwd: repo }, deps())).guards.find((g) => g.id === 'credential_scan')?.outcome).toBe('block');
    runGit(['reset', '-q', 'key.pem'], repo);
    stage(repo, 'big.bin', Buffer.alloc(6 * 1024 * 1024, 1));
    const big = await runPreBash({ event: 'pre-bash', command: 'git commit -m x', cwd: repo }, deps());
    expect(big.block).toBe(true);
    expect(big.guards.find((g) => g.id === 'oversize_file')?.outcome).toBe('block');
    expect(big.messages.join('\n')).toContain('big.bin');
    const notCommit = await runPreBash({ event: 'pre-bash', command: 'git status', cwd: repo }, deps());
    expect(notCommit.guards.find((g) => g.id === 'oversize_file')?.outcome).toBe('silent');
  });
});

describe('pii_sink_warn', () => {
  it('warns but never blocks on personal data heading to a sink', async () => {
    const repo = makeRepo({ 'a': '1' });
    stage(repo, 'auth.ts', 'console.log(user.email);\n');
    const r = await runPreBash({ event: 'pre-bash', command: 'git commit -m x', cwd: repo }, deps());
    expect(r.guards.find((g) => g.id === 'pii_sink_warn')?.outcome).toBe('warn');
    expect(r.guards.find((g) => g.id === 'credential_scan')?.outcome).toBe('pass');
    expect(r.block).toBe(false);
  });
});

describe('commit_gate and publish_gate', () => {
  it('blocks a commit on a unit branch with failing commit gates and is silent without a unit', async () => {
    const { repo, ctx, dir } = await repoWithUnit();
    stage(repo, 'feature.txt', 'new\n');
    const blocked = await runPreBash({ event: 'pre-bash', command: 'git commit -m "ABC-1: x"', cwd: repo }, deps({ vault: ctx.vault }));
    expect(blocked.block).toBe(true);
    expect(blocked.guards.find((g) => g.id === 'commit_gate')?.outcome).toBe('block');
    expect(blocked.messages.join('\n')).toContain('self_critique');
    const s = readState(dir);
    const at = '2026-09-04T00:00:00.000Z';
    writeState(dir, { ...s, evidence: [{ kind: 'self_critique', cycle: 0, recorded_at: at, payload: { findings: [] } }, { kind: 'pii', cycle: 0, recorded_at: at, payload: { findings: [] } }], runs: [{ id: 'r', command: 'true', exit: 0, summary: '', log: '~/l', started_at: at, ended_at: at, cycle: 0 }] });
    const ok = await runPreBash({ event: 'pre-bash', command: 'git commit -m "ABC-1: x"', cwd: repo }, deps({ vault: ctx.vault }));
    expect(ok.guards.find((g) => g.id === 'commit_gate')?.outcome).toBe('pass');
    runGit(['checkout', '-q', 'main'], repo);
    const silent = await runPreBash({ event: 'pre-bash', command: 'git commit -m x', cwd: repo }, deps({ vault: ctx.vault }));
    expect(silent.guards.find((g) => g.id === 'commit_gate')?.outcome).toBe('silent');
  });

  it('blocks a push or PR creation while publish gates fail', async () => {
    const { repo, ctx, dir } = await repoWithUnit();
    writeState(dir, { ...readState(dir), stage: 'publish' });
    for (const cmd of ['git push origin ABC-1-x', 'gh pr create --fill', 'glab merge-request create']) {
      const r = await runPreBash({ event: 'pre-bash', command: cmd, cwd: repo }, deps({ vault: ctx.vault }));
      expect(r.guards.find((g) => g.id === 'publish_gate')?.outcome, cmd).toBe('block');
      expect(r.messages.join('\n'), cmd).toMatch(/challenge_passed|criteria_validated|claims_audited/);
    }
  });
});

describe('transition_preview and stop_status', () => {
  it('previews the next stage gates for a unit advance shape and prints status on stop', async () => {
    const { repo, ctx } = await repoWithUnit();
    const preview = await runPreBash({ event: 'pre-bash', command: 'harness unit advance ABC-1', cwd: repo }, deps({ vault: ctx.vault }));
    expect(preview.block).toBe(false);
    expect(preview.guards.find((g) => g.id === 'transition_preview')?.outcome).toBe('warn');
    expect(preview.messages.join('\n')).toMatch(/self_critique_recorded/);
    const stop = await runStop({ event: 'stop', cwd: repo }, deps({ vault: ctx.vault }));
    expect(stop.message).toBe('ABC-1 · commit · cycle 0 · thorough · ABC-1-x');
    runGit(['checkout', '-q', 'main'], repo);
    expect((await runStop({ event: 'stop', cwd: repo }, deps({ vault: ctx.vault }))).message).toBe('');
  });
});
