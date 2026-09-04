import type { Hunkfile } from './diff-parse.js';
export type PiiSink = 'log' | 'storage' | 'analytics' | 'error_body' | 'other';
export interface PiiFinding {
    file: string;
    line: number;
    sink: PiiSink;
    text: string;
}
/** Added lines where an identity-shaped value flows into a sink. */
export declare function piiAudit(diff: Hunkfile[]): PiiFinding[];
