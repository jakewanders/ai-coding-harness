import { z } from 'zod';
/**
 * Brief header contract. `unit brief` opens with this fenced YAML block so a
 * skill can read the unit, mode, stage, seats, gates and config problems
 * before any prose. Published in docs/brief-contract.md.
 */
export declare const BRIEF_CONTRACT = "harness-brief/1";
export declare const SEAT_NAMES: readonly ['tracker', 'codehost', 'docs', 'design', 'chat', 'reviewbot'];
export type SeatName = (typeof SEAT_NAMES)[number];
export declare const SEVERITIES: readonly ['block', 'warn', 'off'];
export type Severity = (typeof SEVERITIES)[number];
export declare const GATE_STATUSES: readonly ['pass', 'fail', 'n/a'];
export type GateStatus = (typeof GATE_STATUSES)[number];
export interface ConfigError {
    file: string;
    path: string;
    line: number | null;
    message: string;
    valid_keys?: string[];
}
export declare const ConfigErrorSchema: z.ZodType<ConfigError>;
export interface HeaderGate {
    id: string;
    severity: Severity;
    status: GateStatus;
}
export interface BriefHeader {
    contract: typeof BRIEF_CONTRACT;
    unit: string;
    mode: string;
    stage: string;
    repo: string;
    worktree: string | null;
    base_branch: string;
    root: string;
    seats: Record<SeatName, string[] | 'unwired'>;
    capabilities: Record<string, unknown>;
    gates: HeaderGate[];
    docs: string[];
    config_errors: ConfigError[];
}
export declare const HeaderSchema: z.ZodType<BriefHeader>;
/** Header keys in contract order; `contract` is always first. */
export declare const HEADER_KEYS: ReadonlyArray<keyof BriefHeader>;
/** Fenced yaml block whose first line is `contract: harness-brief/1`. */
export declare function renderHeader(h: BriefHeader): string;
