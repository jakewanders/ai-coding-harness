import fs from 'node:fs';
import path from 'node:path';
import { currentBranch, gitRoot, remoteUrl } from '../git/exec.js';
import type { ToolContext } from '../registry/tools.js';
import { unitFromBranch } from './ids.js';
import { repoNamespace, unitDir } from './paths.js';
import { readState, type UnitState } from './state.js';

/** Repo namespace for the checkout containing `cwd` (or `local/<dir>` outside git). */
export function namespaceFor(cwd: string): string {
  const root = gitRoot(cwd);
  return repoNamespace(root ? remoteUrl(root) : null, path.basename(root ?? path.resolve(cwd)));
}

export function unitDirFor(ctx: ToolContext, id: string): string {
  return unitDir(ctx.vault, namespaceFor(ctx.cwd), id);
}

/** Ids of every unit recorded under the namespace, sorted. */
export function listUnitIds(vault: string, ns: string): string[] {
  const dir = path.join(vault, ns, 'units');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'state.json')))
    .map((e) => e.name)
    .sort();
}

export interface LoadedUnit {
  id: string;
  dir: string;
  state: UnitState;
}

/** Load a unit by id, or null when it does not exist in the current namespace. */
export function loadUnit(ctx: ToolContext, id: string): LoadedUnit | null {
  const dir = unitDirFor(ctx, id);
  if (!fs.existsSync(path.join(dir, 'state.json'))) return null;
  return { id, dir, state: readState(dir) };
}

/** Unit id implied by the checked-out branch, or null. */
export function unitFromCwd(ctx: ToolContext): string | null {
  const branch = currentBranch(ctx.cwd);
  if (!branch) return null;
  return unitFromBranch(branch, listUnitIds(ctx.vault, namespaceFor(ctx.cwd)));
}

/** Resolve `id` when given, else the branch-implied unit. */
export function resolveUnit(ctx: ToolContext, id?: string | null): LoadedUnit | null {
  const resolved = id ?? unitFromCwd(ctx);
  return resolved ? loadUnit(ctx, resolved) : null;
}

/** Pinned source text for a unit, or null when nothing was pinned. */
export function readSource(dir: string): string | null {
  const file = path.join(dir, 'source.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
