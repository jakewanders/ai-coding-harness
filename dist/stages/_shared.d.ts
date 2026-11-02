import type { RoleName } from '../contracts/header.js';
import type { BriefContext, BriefRenderer } from '../registry/stages.js';
export type StageSection = 'requirement' | 'plan' | 'review' | 'commands' | 'decisions' | 'ledger';
export interface StageInfo {
    name: string;
    purpose: string;
    roles: RoleName[];
    outputs: string[];
    sections: StageSection[];
    /** Call templates with the unit id filled in. */
    calls: (id: string) => string[];
}
/** Heading, purpose, stage sections, produces, call templates, follow-up. */
export declare function stageBrief(info: StageInfo, ctx: BriefContext, body?: string[]): string;
/** Brief for a standalone flow whose renderer has not landed yet. */
export declare function flowStub(name: string): BriefRenderer;
