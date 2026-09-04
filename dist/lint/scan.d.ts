export interface LintHit {
    file: string;
    line: number;
    term: string;
}
/**
 * Scan each file line by line against the deny patterns. A line that contains
 * `allowMarker` is skipped entirely. Each pattern reports at most one hit per
 * line; hits are ordered by file, line, then pattern order.
 */
export declare function scanFiles(files: string[], deny: RegExp[], allowMarker: string): LintHit[];
/**
 * Every shipped file under `root`: src/, skills/, hooks/, examples/, plus
 * README.md. Excludes dist/, node_modules/, docs/, test/ at any depth.
 * Missing directories are ignored.
 */
export declare function collectShipped(root: string): string[];
