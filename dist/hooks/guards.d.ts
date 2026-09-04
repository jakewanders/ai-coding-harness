import { type LoadedConfig } from '../config/load.js';
import '../gates/index.js';
import type { HookPayload } from './adapter.js';
export interface GuardDeps {
    env: NodeJS.ProcessEnv;
    now: () => Date;
    vault?: string;
    config?: LoadedConfig;
}
export type GuardOutcome = 'block' | 'warn' | 'pass' | 'silent';
export interface GuardReport {
    id: string;
    outcome: GuardOutcome;
    message?: string;
}
export interface PreBashResult {
    block: boolean;
    messages: string[];
    guards: GuardReport[];
}
export declare const OVERSIZE_BYTES: number;
/** Run every pre-bash guard in order; any block wins, warnings are collected. */
export declare function runPreBash(payload: HookPayload, deps: GuardDeps): Promise<PreBashResult>;
/** Stop hook: the one-line status of the unit implied by the branch, or nothing. */
export declare function runStop(payload: HookPayload, deps: GuardDeps): Promise<{
    message: string;
}>;
