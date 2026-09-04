/** Home directory used for `~` handling: HARNESS_HOME wins, then the OS home. */
export declare function defaultHome(env?: NodeJS.ProcessEnv): string;
/** Collapse an absolute path under `home` to the `~/...` form; others pass through. */
export declare function homeRelative(abs: string, home?: string): string;
/** Expand a `~` or `~/...` path under `home`; other paths pass through. */
export declare function expandHome(p: string, home?: string): string;
/**
 * Vault location: env HARNESS_VAULT, then the configured store path, then
 * `~/.harness/vault` under HARNESS_HOME (or the OS home).
 */
export declare function vaultRoot(env?: NodeJS.ProcessEnv, storePath?: string | null): string;
/**
 * `<host>/<owner>/<name>` from an origin remote url (ssh scp-style, ssh://,
 * https://, with or without `.git`), or `local/<dirName>` when there is no
 * remote or it cannot be parsed.
 */
export declare function repoNamespace(remoteUrl: string | null, dirName: string): string;
/** Directory holding a unit's records inside the vault. */
export declare function unitDir(vault: string, ns: string, id: string): string;
