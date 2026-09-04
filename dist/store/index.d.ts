export declare const INDEX_SCHEMA = 1;
export interface DigestEntry {
    id: string;
    repo: string;
    summary: string;
    decisions: string[];
    tags: string[];
    tokens: string[];
    updated_at: string;
}
export interface DigestIndex {
    schema: 1;
    entries: DigestEntry[];
}
export interface Digest {
    summary: string;
    decisions: string[];
    tags: string[];
}
/** Lowercase alphanumeric tokens, stopwords and one-character tokens dropped, order-preserving unique. */
export declare function tokenize(text: string): string[];
export declare function indexPath(vault: string): string;
export declare function readIndex(vault: string): DigestIndex;
export declare function writeIndex(vault: string, index: DigestIndex): void;
export declare function entryFor(id: string, repo: string, digest: Digest, updatedAt: string): DigestEntry;
/** Insert or replace the entry for (repo, id). */
export declare function upsertEntry(vault: string, entry: DigestEntry): DigestIndex;
export interface SearchHit extends DigestEntry {
    score: number;
    matched: string[];
}
/** Term-overlap score: one point per query token found, two when it is a tag. */
export declare function searchIndex(index: DigestIndex, query: string, opts?: {
    repo?: string;
    limit?: number;
}): SearchHit[];
export declare function renderDigest(id: string, digest: Digest): string;
export declare function parseDigest(md: string): Digest;
/** Every `<repo>/units/<id>/digest.md` under the vault, with repo and id. */
export declare function findDigestFiles(vault: string): Array<{
    repo: string;
    id: string;
    file: string;
}>;
/** Rebuild the index from every digest.md in the vault. */
export declare function rebuildIndex(vault: string, now?: () => Date): DigestIndex;
