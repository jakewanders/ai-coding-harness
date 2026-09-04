export interface Guess {
    field: string;
    value: string;
    evidence: string;
}
export interface InferredProfile {
    namespace: string;
    guesses: Guess[];
}
export declare const COMMAND_FIELDS: readonly ['install', 'check', 'test', 'lint', 'typecheck', 'e2e'];
/** Target names declared in a Makefile (`name:` at line start, not `.PHONY`-style specials). */
export declare function makefileTargets(text: string): string[];
/**
 * Inspect a directory and guess its repo profile. Every guess carries the
 * evidence it was drawn from. Never throws; an empty directory yields no guesses.
 */
export declare function inferProfile(cwd: string): InferredProfile;
