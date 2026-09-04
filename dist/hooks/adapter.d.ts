export type HookEvent = 'pre-bash' | 'stop';
export interface HookPayload {
    event: HookEvent;
    command?: string;
    cwd: string;
}
/** Normalize the host's hook stdin JSON; unknown shapes become a pre-bash payload with no command. */
export declare function parseHostPayload(json: string, guardHint?: string): HookPayload;
export interface Decision {
    exit: number;
    stdout: string;
    stderr: string;
}
/** Block: deny decision on stdout, reason on stderr, exit 2. Pass: optional system message, exit 0. */
export declare function renderDecision(block: boolean, message: string): Decision;
