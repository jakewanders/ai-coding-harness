export interface DiffLine {
    line: number;
    text: string;
}
export interface Hunkfile {
    path: string;
    added: DiffLine[];
    removed: DiffLine[];
    isNew: boolean;
}
/** Parse a unified diff into per-file added/removed lines with line numbers. */
export declare function parseDiff(unified: string): Hunkfile[];
/** Added text of every file joined, for keyword analyses. */
export declare function addedText(files: Hunkfile[]): string;
