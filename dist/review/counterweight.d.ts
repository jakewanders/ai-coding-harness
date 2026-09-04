import type { HarnessConfig } from '../config/schema.js';
import type { FindingSeverity } from '../evidence/kinds.js';
import { runCommand } from '../exec/run.js';
export type ProviderKind = 'cli' | 'http' | 'fallback-stub';
export interface Provider {
    kind: ProviderKind;
    describe(): string;
    review(prompt: string): Promise<string>;
}
export interface CounterweightDeps {
    fetch?: typeof fetch;
    exec?: typeof runCommand;
}
export declare const API_KEY_VAR = "COUNTERWEIGHT_API_KEY";
export declare const CLI_TIMEOUT_MS: number;
export declare const STUB_TEXT: string;
/** Configured CLI → HTTP endpoint (key from dotenv or env) → same-model stub that declares itself. */
export declare function resolveCounterweight(config: HarnessConfig, env: NodeJS.ProcessEnv, deps?: CounterweightDeps): Provider;
export interface Finding {
    severity: FindingSeverity;
    text: string;
    class?: string;
}
export interface CounterweightRecord {
    provider: string;
    findings: Finding[];
}
/** `severity:` plus the first three words of the text, lowercased and stripped of punctuation. */
export declare function classOf(f: Finding): string;
/**
 * Track finding classes across cycles: a class seen more than `cap` times
 * (previous records plus now) is reported as capped and dropped from active.
 */
export declare function trackFindings(previous: CounterweightRecord[], current: Finding[], cap?: number): {
    active: Finding[];
    capped: Array<{
        class: string;
        count: number;
    }>;
};
