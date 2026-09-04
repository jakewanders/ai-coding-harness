import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../src/config/load.js';
import type { ToolContext } from '../../src/registry/tools.js';
import { vaultRoot } from '../../src/store/paths.js';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A ToolContext bound to the hermetic env of the current test. */
export function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  const env = overrides.env ?? { ...process.env };
  const cwd = overrides.cwd ?? process.env.HARNESS_HOME!;
  const config = overrides.config ?? loadConfig({ cwd, env, pluginRoot: repoRoot });
  return {
    cwd,
    env,
    config,
    vault: vaultRoot(env, config.config.store?.path),
    root: repoRoot,
    now: () => new Date('2026-09-04T12:00:00.000Z'),
    ...overrides,
  };
}
