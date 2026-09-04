/** Tracked files (git ls-files, honouring .gitignore) or a filesystem walk outside git. Paths are relative. */
export declare function listFiles(worktree: string): string[];
/** Read a repo file as text, or null when missing, binary-looking, or too large. */
export declare function readText(worktree: string, rel: string): string | null;
/** Minimal glob: `**` any path, `*` within a segment, `?` one char. */
export declare function globToRegExp(glob: string): RegExp;
export declare function matchGlobs(files: string[], globs: string[]): string[];
