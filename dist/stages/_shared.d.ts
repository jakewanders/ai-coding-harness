import type { SeatName } from '../contracts/header.js';
import type { BriefContext, BriefRenderer } from '../registry/stages.js';
export interface StageInfo {
    name: string;
    purpose: string;
    seats: SeatName[];
    outputs: string[];
}
/** Heading, purpose sentence, and the unit-brief follow-up template. */
export declare function stageBrief(info: StageInfo, ctx: BriefContext, body?: string[]): string;
/** Brief for a standalone flow whose renderer has not landed yet. */
export declare function flowStub(name: string): BriefRenderer;
