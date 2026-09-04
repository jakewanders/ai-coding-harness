import os from 'node:os';
import path from 'node:path';
/** Home directory used for `~` handling: HARNESS_HOME wins, then the OS home. */
export function defaultHome(env = process.env) {
    return env.HARNESS_HOME || os.homedir();
}
/** Collapse an absolute path under `home` to the `~/...` form; others pass through. */
export function homeRelative(abs, home = defaultHome()) {
    const h = home.replace(/\/+$/, '');
    if (abs === h)
        return '~';
    if (abs.startsWith(h + path.sep))
        return '~' + abs.slice(h.length);
    return abs;
}
/** Expand a `~` or `~/...` path under `home`; other paths pass through. */
export function expandHome(p, home = defaultHome()) {
    if (p === '~')
        return home;
    if (p.startsWith('~/'))
        return path.join(home, p.slice(2));
    return p;
}
/**
 * Vault location: env HARNESS_VAULT, then the configured store path, then
 * `~/.harness/vault` under HARNESS_HOME (or the OS home).
 */
export function vaultRoot(env = process.env, storePath) {
    if (env.HARNESS_VAULT)
        return env.HARNESS_VAULT;
    const home = defaultHome(env);
    if (storePath)
        return expandHome(storePath, home);
    return path.join(home, '.harness', 'vault');
}
/**
 * `<host>/<owner>/<name>` from an origin remote url (ssh scp-style, ssh://,
 * https://, with or without `.git`), or `local/<dirName>` when there is no
 * remote or it cannot be parsed.
 */
export function repoNamespace(remoteUrl, dirName) {
    const fallback = `local/${dirName}`;
    if (!remoteUrl)
        return fallback;
    const url = remoteUrl.trim();
    if (!url)
        return fallback;
    let host;
    let repoPath;
    const scp = /^(?:[\w.-]+@)?([\w.-]+):(?!\/\/)(.+)$/.exec(url);
    if (scp) {
        host = scp[1];
        repoPath = scp[2];
    }
    else {
        const full = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([\w.-]+)(?::\d+)?\/(.+)$/i.exec(url);
        if (full) {
            host = full[1];
            repoPath = full[2];
        }
    }
    if (!host || !repoPath)
        return fallback;
    const segments = repoPath
        .replace(/\.git\/?$/, '')
        .split('/')
        .filter((s) => s.length > 0);
    if (segments.length < 2)
        return fallback;
    return [host.toLowerCase(), ...segments].join('/');
}
/** Directory holding a unit's records inside the vault. */
export function unitDir(vault, ns, id) {
    return path.join(vault, ns, 'units', id);
}
