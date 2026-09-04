/** Tracker-form id: `^[A-Z][A-Z0-9]+-\d+$`. Used for url templates and branch matching only. */
export declare const TRACKER_ID: RegExp;
export declare function isTrackerId(s: string): boolean;
/** `local-` plus the first 8 hex of sha256 over the source text; stable for equal text. */
export declare function syntheticId(sourceText: string): string;
/**
 * Unit id embedded in a branch name: the first tracker-form token, else a
 * known id that appears as a whole segment of the branch, else null.
 */
export declare function unitFromBranch(branch: string, knownIds?: string[]): string | null;
/** Lowercase ASCII slug: letters, digits and single dashes. */
export declare function slugify(title: string): string;
export declare const BRANCH_MAX = 60;
/** `<id>-<slug>` trimmed to 60 chars, never ending in a dash. */
export declare function branchNameFor(id: string, title: string): string;
