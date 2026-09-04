import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { unitDir } from './paths.js';
/** Create the vault directory and git-initialize it when `.git` is absent. */
export function ensureVault(root) {
    fs.mkdirSync(root, { recursive: true });
    if (fs.existsSync(path.join(root, '.git')))
        return;
    execFileSync('git', ['-c', 'init.defaultBranch=main', 'init', '-q'], { cwd: root, stdio: 'ignore' });
}
export const UNIT_SUBDIRS = ['reviews', 'runs', 'drafts'];
/** Create `units/<id>` with its reviews, runs and drafts subdirectories. */
export function ensureUnitDir(vault, ns, id) {
    const dir = unitDir(vault, ns, id);
    for (const sub of UNIT_SUBDIRS)
        fs.mkdirSync(path.join(dir, sub), { recursive: true });
    return dir;
}
