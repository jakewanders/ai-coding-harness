import fs from 'node:fs';
import path from 'node:path';
import { currentBranch, gitRoot, remoteUrl } from '../git/exec.js';
import { unitFromBranch } from './ids.js';
import { repoNamespace, unitDir } from './paths.js';
import { readState } from './state.js';
/** Repo namespace for the checkout containing `cwd` (or `local/<dir>` outside git). */
export function namespaceFor(cwd) {
    const root = gitRoot(cwd);
    return repoNamespace(root ? remoteUrl(root) : null, path.basename(root ?? path.resolve(cwd)));
}
export function unitDirFor(ctx, id) {
    return unitDir(ctx.vault, namespaceFor(ctx.cwd), id);
}
/** Ids of every unit recorded under the namespace, sorted. */
export function listUnitIds(vault, ns) {
    const dir = path.join(vault, ns, 'units');
    if (!fs.existsSync(dir))
        return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'state.json')))
        .map((e) => e.name)
        .sort();
}
/** Load a unit by id, or null when it does not exist in the current namespace. */
export function loadUnit(ctx, id) {
    const dir = unitDirFor(ctx, id);
    if (!fs.existsSync(path.join(dir, 'state.json')))
        return null;
    return { id, dir, state: readState(dir) };
}
/** Unit id implied by the checked-out branch, or null. */
export function unitFromCwd(ctx) {
    const branch = currentBranch(ctx.cwd);
    if (!branch)
        return null;
    return unitFromBranch(branch, listUnitIds(ctx.vault, namespaceFor(ctx.cwd)));
}
/** Resolve `id` when given, else the branch-implied unit. */
export function resolveUnit(ctx, id) {
    const resolved = id ?? unitFromCwd(ctx);
    return resolved ? loadUnit(ctx, resolved) : null;
}
/** Pinned source text for a unit, or null when nothing was pinned. */
export function readSource(dir) {
    const file = path.join(dir, 'source.md');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
