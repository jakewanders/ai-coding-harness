export interface SyncResult {
    ok: boolean;
    summary: string;
    detail: string[];
}
/** Push/pull the vault's git remote when `store.remote` is configured; otherwise skip. */
export declare function syncVault(vault: string, remote: string | null | undefined): SyncResult;
