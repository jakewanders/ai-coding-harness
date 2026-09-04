import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeTmpDir } from './tmp.js';

/** Run git in `cwd` with a fixed identity and no system/global config. */
export function runGit(args: string[], cwd: string): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Harness Test', '-c', 'user.email=harness@example.test', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } },
  ).trim();
}

/**
 * Create a temp git repo containing `files` with one commit on `branch`
 * (default main). With `remote`, also create a bare clone next to it, wire it
 * as `origin`, fetch it, and set origin/HEAD; the remote url is that path
 * unless a literal url string is given (which is then only added, never contacted).
 */
export function makeRepo(files: Record<string, string>, opts: { remote?: string | boolean; branch?: string } = {}): string {
  const branch = opts.branch ?? 'main';
  const dir = makeTmpDir('harness-git');
  runGit(['init', '-q', '-b', branch], dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  runGit(['add', '-A'], dir);
  runGit(['commit', '-q', '--allow-empty', '-m', 'initial'], dir);
  if (opts.remote === true) {
    const bare = makeTmpDir('harness-git-remote') + '.git';
    runGit(['clone', '-q', '--bare', dir, bare], dir);
    runGit(['remote', 'add', 'origin', bare], dir);
    runGit(['fetch', '-q', 'origin'], dir);
    runGit(['remote', 'set-head', 'origin', '-a'], dir);
  } else if (typeof opts.remote === 'string') {
    runGit(['remote', 'add', 'origin', opts.remote], dir);
  }
  return dir;
}
