export declare const HISTORY_FILE = "history.md";
/** Append `- <ISO timestamp> <line>` to the unit's history.md, creating it if needed. */
export declare function appendHistory(dir: string, line: string, now?: () => Date): void;
