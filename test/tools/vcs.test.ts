import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dispatch } from '../../src/registry/tools.js';
import { readState, writeState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { unitTool } from '../../src/tools/unit.js';
import { vcsTool } from '../../src/tools/vcs.js';
import { makeCtx } from '../helpers/ctx.js';
import { landOnRemote, makeRepo, runGit } from '../helpers/git.js';

async function unitInRepo(opts: { remote?: boolean; under?: string; config?: string } = {}, id = 'VCS-1') {
  const files: Record<string, string> = { 'README.md': 'hello\n' };
  if (opts.config) files['.harness.yaml'] = opts.config;
  const repo = makeRepo(files, { remote: opts.remote ?? true, under: opts.under });
  const ctx = makeCtx({ cwd: repo });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id }, ctx);
  return { repo, ctx };
}

describe('vcs fetch', () => {
  it('fetches origin and notes whether a remote exists', async () => {
    const withRemote = await unitInRepo();
    const a = await dispatch(vcsTool, { action: 'fetch', id: 'VCS-1' }, withRemote.ctx);
    expect(a.envelope.ok).toBe(true);
    expect(a.envelope.data).toMatchObject({ remote: true });
    const without = await unitInRepo({ remote: false });
    const b = await dispatch(vcsTool, { action: 'fetch', id: 'VCS-1' }, without.ctx);
    expect(b.envelope.ok).toBe(true);
    expect(b.envelope.data).toMatchObject({ remote: false });
    expect(b.text).toMatch(/no remote/i);
  });
});

describe('vcs diff', () => {
  it('diffs against origin/main after fetching, so a remote commit shows up', async () => {
    const { repo, ctx } = await unitInRepo();
    landOnRemote(repo, { 'remote.txt': 'landed elsewhere\n' });
    fs.writeFileSync(path.join(repo, 'local.txt'), 'local work\n');
    const r = await dispatch(vcsTool, { action: 'diff', id: 'VCS-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toMatchObject({ ref: 'origin/main', remote: true, truncated: false });
    expect(r.text).toContain('remote.txt');
    expect(r.text).toContain('local.txt');
    const stat = await dispatch(vcsTool, { action: 'diff', id: 'VCS-1', stat: true }, ctx);
    expect(stat.text).toMatch(/remote\.txt\s*\|/);
  });

  it('refuses a local base-branch comparison when a remote exists', async () => {
    const { ctx } = await unitInRepo();
    const r = await dispatch(vcsTool, { action: 'diff', id: 'VCS-1', ref: 'main' }, ctx);
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.summary).toContain('origin/main');
  });

  it('falls back to the local base branch only without a remote, and says so', async () => {
    const { repo, ctx } = await unitInRepo({ remote: false });
    fs.writeFileSync(path.join(repo, 'local.txt'), 'x\n');
    const r = await dispatch(vcsTool, { action: 'diff', id: 'VCS-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toMatchObject({ ref: 'main', remote: false });
    expect(r.text).toMatch(/no remote/i);
    const head = await dispatch(vcsTool, { action: 'diff', id: 'VCS-1', against: 'head' }, ctx);
    expect(head.envelope.data).toMatchObject({ ref: 'HEAD' });
    expect(head.text).toContain('local.txt');
  });
});

describe('vcs worktree and branch', () => {
  it('creates a sibling worktree and records a home-relative path and branch', async () => {
    const { repo, ctx } = await unitInRepo({ under: process.env.HARNESS_HOME! });
    const r = await dispatch(vcsTool, { action: 'worktree', id: 'VCS-1', title: 'Add the thing' }, ctx);
    expect(r.envelope.ok).toBe(true);
    const wt = path.join(path.dirname(repo), `${path.basename(repo)}-VCS-1`);
    expect(fs.statSync(wt).isDirectory()).toBe(true);
    expect(runGit(['rev-parse', '--abbrev-ref', 'HEAD'], wt)).toBe('VCS-1-add-the-thing');
    const raw = fs.readFileSync(path.join(unitDirFor(ctx, 'VCS-1'), 'state.json'), 'utf8');
    expect(raw).toContain('"worktree": "~/');
    const state = readState(unitDirFor(ctx, 'VCS-1'));
    expect(state.worktree).toBe(wt);
    expect(state.branch).toBe('VCS-1-add-the-thing');
    const again = await dispatch(vcsTool, { action: 'worktree', id: 'VCS-1' }, ctx);
    expect(again.envelope.ok).toBe(true);
    expect(again.envelope.data).toMatchObject({ created: false, worktree: wt });
  });

  it('creates the branch in place when isolation is branch', async () => {
    const { repo, ctx } = await unitInRepo({ remote: false });
    const ns = readState(unitDirFor(ctx, 'VCS-1')).repo;
    fs.writeFileSync(path.join(repo, '.harness.yaml'), `schema: 1\nrepos:\n  "${ns}":\n    capabilities:\n      isolation: branch\n`);
    const ctx2 = makeCtx({ cwd: repo });
    const r = await dispatch(vcsTool, { action: 'worktree', id: 'VCS-1' }, ctx2);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toMatchObject({ isolation: 'branch', worktree: null, branch: 'VCS-1' });
    expect(runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repo)).toBe('VCS-1');
    expect(readState(unitDirFor(ctx2, 'VCS-1')).worktree).toBeNull();
  });

  it('branch creates or checks out the unit branch', async () => {
    const { repo, ctx } = await unitInRepo({ remote: false });
    const r = await dispatch(vcsTool, { action: 'branch', id: 'VCS-1', title: 'Fix it' }, ctx);
    expect(r.envelope.data).toMatchObject({ branch: 'VCS-1-fix-it', created: true });
    runGit(['checkout', '-q', 'main'], repo);
    const again = await dispatch(vcsTool, { action: 'branch', id: 'VCS-1' }, ctx);
    expect(again.envelope.data).toMatchObject({ branch: 'VCS-1-fix-it', created: false });
    expect(runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repo)).toBe('VCS-1-fix-it');
  });
});

describe('vcs status and commit', () => {
  it('refuses to commit while a blocking gate fails, then commits and moves to review', async () => {
    const { ctx } = await unitInRepo();
    await dispatch(vcsTool, { action: 'worktree', id: 'VCS-1' }, ctx);
    for (const to of ['plan', 'build', 'commit']) await dispatch(unitTool, { action: 'advance', id: 'VCS-1', to }, ctx);
    const wt = readState(unitDirFor(ctx, 'VCS-1')).worktree!;
    fs.writeFileSync(path.join(wt, 'feature.txt'), 'new\n');

    const status = await dispatch(vcsTool, { action: 'status', id: 'VCS-1' }, ctx);
    expect(status.envelope.ok).toBe(true);
    expect((status.envelope.data as { entries: string[] }).entries.some((e) => e.includes('feature.txt'))).toBe(true);

    const refused = await dispatch(vcsTool, { action: 'commit', id: 'VCS-1', message: 'VCS-1: add feature' }, ctx);
    expect(refused.envelope.ok).toBe(false);
    expect(refused.text).toContain('self_critique');
    expect(refused.text).toContain('pii');
    expect(runGit(['status', '--porcelain'], wt)).toContain('feature.txt');

    const dir = unitDirFor(ctx, 'VCS-1');
    const s = readState(dir);
    writeState(dir, {
      ...s,
      evidence: [
        { kind: 'self_critique', cycle: 0, recorded_at: '2026-09-04T00:00:00.000Z', payload: { findings: [] } },
        { kind: 'pii', cycle: 0, recorded_at: '2026-09-04T00:00:00.000Z', payload: { findings: [] } },
      ],
      runs: [{ id: 'r1', command: 'true', exit: 0, summary: '', log: '~/x.log', started_at: '2026-09-04T00:00:00.000Z', ended_at: '2026-09-04T00:00:01.000Z' }],
    });
    const ok = await dispatch(vcsTool, { action: 'commit', id: 'VCS-1', message: 'VCS-1: add feature' }, ctx);
    expect(ok.envelope.ok).toBe(true);
    const data = ok.envelope.data as { sha: string; stage: string };
    expect(data.sha).toMatch(/^[0-9a-f]{7,40}$/);
    expect(data.stage).toBe('review');
    const after = readState(dir);
    expect(after.stage).toBe('review');
    expect(after.commits).toHaveLength(1);
    expect(after.commits[0]).toMatchObject({ message: 'VCS-1: add feature', cycle: 0 });
    expect(runGit(['log', '-1', '--format=%s'], wt)).toBe('VCS-1: add feature');
    expect(runGit(['status', '--porcelain'], wt)).toBe('');

    const nothing = await dispatch(vcsTool, { action: 'commit', id: 'VCS-1', message: 'again' }, ctx);
    expect(nothing.envelope.ok).toBe(false);
    expect(nothing.envelope.summary).toMatch(/nothing to commit/i);

    const st = await dispatch(vcsTool, { action: 'status', id: 'VCS-1' }, ctx);
    expect(st.envelope.data).toMatchObject({ ahead: 1, behind: 0, clean: true });
  });

  it('refuses to commit on a protected branch', async () => {
    const { repo, ctx } = await unitInRepo({ remote: false });
    fs.writeFileSync(path.join(repo, 'x.txt'), 'x\n');
    const r = await dispatch(vcsTool, { action: 'commit', id: 'VCS-1', message: 'oops' }, ctx);
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.summary).toContain('protected');
  });
});

describe('vcs cleanup', () => {
  it('removes the worktree, deletes a merged branch, and clears state', async () => {
    const { repo, ctx } = await unitInRepo();
    await dispatch(vcsTool, { action: 'worktree', id: 'VCS-1' }, ctx);
    const wt = readState(unitDirFor(ctx, 'VCS-1')).worktree!;
    expect(fs.existsSync(wt)).toBe(true);
    const r = await dispatch(vcsTool, { action: 'cleanup', id: 'VCS-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(fs.existsSync(wt)).toBe(false);
    expect(runGit(['worktree', 'list'], repo)).not.toContain(wt);
    expect(runGit(['branch', '--list', 'VCS-1'], repo)).toBe('');
    const state = readState(unitDirFor(ctx, 'VCS-1'));
    expect(state.worktree).toBeNull();
    expect(r.envelope.data).toMatchObject({ worktree_removed: true, branch_deleted: true });
  });

  it('keeps an unmerged branch and says so', async () => {
    const { ctx } = await unitInRepo({ remote: false });
    await dispatch(vcsTool, { action: 'worktree', id: 'VCS-1' }, ctx);
    const wt = readState(unitDirFor(ctx, 'VCS-1')).worktree!;
    fs.writeFileSync(path.join(wt, 'w.txt'), 'w\n');
    runGit(['add', '-A'], wt);
    runGit(['commit', '-q', '-m', 'work'], wt);
    const r = await dispatch(vcsTool, { action: 'cleanup', id: 'VCS-1' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.data).toMatchObject({ worktree_removed: true, branch_deleted: false });
    expect(r.text).toMatch(/not merged/i);
  });
});
