import fs from 'node:fs';
import path from 'node:path';
import type { ConfigError } from '../contracts/header.js';
import { loadKit, type Kit } from './manifest.js';

export type { Kit, KitDoc } from './manifest.js';

/**
 * Kit search path, in order: HARNESS_KIT_PATHS (colon-separated),
 * ~/.harness/kits, the plugin manager cache (<pluginRoot>/../../cache/*\/kits),
 * then the sibling kits checkout <pluginRoot>/../ai-coding-harness-kits/kits.
 */
export function kitSearchPaths(env: NodeJS.ProcessEnv, home: string, pluginRoot: string): string[] {
  const out: string[] = [];
  for (const p of (env.HARNESS_KIT_PATHS ?? '').split(':').map((s) => s.trim()).filter(Boolean)) out.push(p);
  out.push(path.join(home, '.harness', 'kits'));
  const cache = path.resolve(pluginRoot, '..', '..', 'cache');
  if (fs.existsSync(cache)) {
    for (const entry of fs.readdirSync(cache, { withFileTypes: true })) {
      if (entry.isDirectory()) out.push(path.join(cache, entry.name, 'kits'));
    }
  } else {
    out.push(path.join(cache, '*', 'kits'));
  }
  out.push(path.resolve(pluginRoot, '..', 'ai-coding-harness-kits', 'kits'));
  return out;
}

export interface Discovery {
  kits: Kit[];
  errors: ConfigError[];
  missing: string[];
}

/** Find each named kit along the search path; the first directory containing it wins. */
export function discoverKitsDetailed(names: string[], env: NodeJS.ProcessEnv, home: string, pluginRoot: string): Discovery {
  const kits: Kit[] = [];
  const errors: ConfigError[] = [];
  const missing: string[] = [];
  const roots = kitSearchPaths(env, home, pluginRoot).filter((p) => !p.includes('*'));
  for (const name of names) {
    const dir = roots.map((r) => path.join(r, name)).find((d) => fs.existsSync(path.join(d, 'kit.yaml')));
    if (!dir) { missing.push(name); continue; }
    const kit = loadKit(dir);
    if ('error' in kit) errors.push(kit.error);
    else kits.push(kit);
  }
  return { kits, errors, missing };
}

export function discoverKits(names: string[], env: NodeJS.ProcessEnv, home: string, pluginRoot: string): Kit[] {
  return discoverKitsDetailed(names, env, home, pluginRoot).kits;
}
