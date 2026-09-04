import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git/exec.js';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', 'vendor', 'target', '.venv']);
const MAX_FILE_BYTES = 512 * 1024;

/** Tracked files (git ls-files, honouring .gitignore) or a filesystem walk outside git. Paths are relative. */
export function listFiles(worktree: string): string[] {
  const r = git(['ls-files', '--cached', '--others', '--exclude-standard'], worktree);
  if (r.ok) return r.stdout.split('\n').filter(Boolean).sort();
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); }
      else if (e.isFile()) out.push(path.relative(worktree, path.join(dir, e.name)));
    }
  };
  if (fs.existsSync(worktree)) walk(worktree);
  return out.sort();
}

/** Read a repo file as text, or null when missing, binary-looking, or too large. */
export function readText(worktree: string, rel: string): string | null {
  const abs = path.join(worktree, rel);
  try {
    const st = fs.statSync(abs);
    if (!st.isFile() || st.size > MAX_FILE_BYTES) return null;
    const buf = fs.readFileSync(abs);
    if (buf.subarray(0, 512).includes(0)) return null;
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

/** Minimal glob: `**` any path, `*` within a segment, `?` one char. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function matchGlobs(files: string[], globs: string[]): string[] {
  const res = globs.map(globToRegExp);
  return files.filter((f) => res.some((re) => re.test(f)));
}
