export interface RunOptions {
    cwd: string;
    timeoutMs: number;
    env?: Record<string, string>;
}
export interface RunOutput {
    exit: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
}
/** Run a shell command, capturing output; kills it after `timeoutMs`. Never throws. */
export declare function runCommand(cmd: string, opts: RunOptions): Promise<RunOutput>;
/** Last `n` non-empty-trailing lines of a text. */
export declare function tailLines(text: string, n: number): string;
