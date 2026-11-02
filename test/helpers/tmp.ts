import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** The real home directory, captured at module load before any test rewrites HOME. */
export const REAL_HOME = os.homedir();

/**
 * Create a fresh temporary directory under the OS temp root. The path is
 * resolved through symlinks (macOS tmpdir is /var -> /private/var) so it matches
 * what git reports for worktrees and prefix comparisons against HARNESS_HOME hold.
 */
export function makeTmpDir(prefix: string): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`)));
}

/**
 * Run `fn` with the given environment variables set, restoring the previous
 * values (or deleting the keys) afterwards, even if `fn` throws.
 */
export async function withEnv(vars: Record<string, string>, fn: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
