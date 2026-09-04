import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultBranch, git, gitRoot, remoteUrl } from '../../src/git/exec.js';
import { makeRepo, runGit } from '../helpers/git.js';
import { makeTmpDir } from '../helpers/tmp.js';

describe('git', () => {
  it('returns ok with stdout for a good command and never throws on a bad one', () => {
    const repo = makeRepo({ 'a.txt': 'a' });
    const good = git(['rev-parse', '--is-inside-work-tree'], repo);
    expect(good).toMatchObject({ ok: true, stdout: 'true' });
    const bad = git(['rev-parse', '--verify', 'no-such-ref'], repo);
    expect(bad.ok).toBe(false);
    expect(bad.stderr.length).toBeGreaterThan(0);
    const nowhere = git(['status'], makeTmpDir('harness-nogit'));
    expect(nowhere.ok).toBe(false);
  });
});

describe('gitRoot / remoteUrl', () => {
  it('finds the root from a nested directory and null outside a repo', () => {
    const repo = makeRepo({ 'sub/dir/file.txt': 'x' });
    expect(gitRoot(path.join(repo, 'sub', 'dir'))).toBe(fs.realpathSync(repo));
    expect(gitRoot(makeTmpDir('harness-nogit'))).toBeNull();
  });

  it('reads the origin url or null', () => {
    expect(remoteUrl(makeRepo({ 'a': '1' }))).toBeNull();
    expect(remoteUrl(makeRepo({ 'a': '1' }, { remote: 'git@example.test:o/n.git' }))).toBe('git@example.test:o/n.git');
  });
});

describe('defaultBranch', () => {
  it('uses origin/HEAD when present', () => {
    const repo = makeRepo({ 'a': '1' }, { branch: 'trunk', remote: true });
    expect(defaultBranch(repo)).toBe('trunk');
  });

  it('falls back to main, then master, then the current branch', () => {
    expect(defaultBranch(makeRepo({ 'a': '1' }, { branch: 'main' }))).toBe('main');
    expect(defaultBranch(makeRepo({ 'a': '1' }, { branch: 'master' }))).toBe('master');
    const repo = makeRepo({ 'a': '1' }, { branch: 'develop' });
    expect(defaultBranch(repo)).toBe('develop');
    runGit(['branch', 'main'], repo);
    expect(defaultBranch(repo)).toBe('main');
  });

  it('returns main outside a repository', () => {
    expect(defaultBranch(makeTmpDir('harness-nogit'))).toBe('main');
  });
});
