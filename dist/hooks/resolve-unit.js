import { currentBranch } from '../git/exec.js';
import { unitFromBranch } from '../store/ids.js';
import { readState } from '../store/state.js';
import { listUnitIds, namespaceFor } from '../store/units.js';
import { unitDir } from '../store/paths.js';
/** The unit implied by the checked-out branch in `cwd`, with its record, or null. */
export function resolveUnitRecord(cwd, vault) {
    const branch = currentBranch(cwd);
    if (!branch)
        return null;
    const ns = namespaceFor(cwd);
    const known = listUnitIds(vault, ns);
    const id = unitFromBranch(branch, known);
    if (!id || !known.includes(id))
        return null;
    const dir = unitDir(vault, ns, id);
    try {
        return { id, dir, state: readState(dir) };
    }
    catch {
        return null;
    }
}
/** The unit state implied by the current branch, or null (guards stay silent). */
export function resolveUnit(cwd, vault) {
    return resolveUnitRecord(cwd, vault)?.state ?? null;
}
