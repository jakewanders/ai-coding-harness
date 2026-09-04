import fs from 'node:fs';
import path from 'node:path';
import { loadKit } from './manifest.js';
/**
 * Kit search path, in order: HARNESS_KIT_PATHS (colon-separated),
 * ~/.harness/kits, the plugin manager cache (<pluginRoot>/../../cache/*\/kits),
 * then the sibling kits checkout <pluginRoot>/../ai-coding-harness-kits/kits.
 */
export function kitSearchPaths(env, home, pluginRoot) {
    const out = [];
    for (const p of (env.HARNESS_KIT_PATHS ?? '').split(':').map((s) => s.trim()).filter(Boolean))
        out.push(p);
    out.push(path.join(home, '.harness', 'kits'));
    const cache = path.resolve(pluginRoot, '..', '..', 'cache');
    if (fs.existsSync(cache)) {
        for (const entry of fs.readdirSync(cache, { withFileTypes: true })) {
            if (entry.isDirectory())
                out.push(path.join(cache, entry.name, 'kits'));
        }
    }
    else {
        out.push(path.join(cache, '*', 'kits'));
    }
    out.push(path.resolve(pluginRoot, '..', 'ai-coding-harness-kits', 'kits'));
    return out;
}
/** Find each named kit along the search path; the first directory containing it wins. */
export function discoverKitsDetailed(names, env, home, pluginRoot) {
    const kits = [];
    const errors = [];
    const missing = [];
    const roots = kitSearchPaths(env, home, pluginRoot).filter((p) => !p.includes('*'));
    for (const name of names) {
        const dir = roots.map((r) => path.join(r, name)).find((d) => fs.existsSync(path.join(d, 'kit.yaml')));
        if (!dir) {
            missing.push(name);
            continue;
        }
        const kit = loadKit(dir);
        if ('error' in kit)
            errors.push(kit.error);
        else
            kits.push(kit);
    }
    return { kits, errors, missing };
}
export function discoverKits(names, env, home, pluginRoot) {
    return discoverKitsDetailed(names, env, home, pluginRoot).kits;
}
