/** Create the vault directory and git-initialize it when `.git` is absent. */
export declare function ensureVault(root: string): void;
export declare const UNIT_SUBDIRS: readonly ['reviews', 'runs', 'drafts'];
/** Create `units/<id>` with its reviews, runs and drafts subdirectories. */
export declare function ensureUnitDir(vault: string, ns: string, id: string): string;
