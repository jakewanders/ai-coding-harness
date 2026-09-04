import { type BriefRenderer } from '../registry/stages.js';
import { type Criterion, type RelatedItem, type Requirement } from '../spec/requirement.js';
export interface Readiness {
    criteria: Criterion[];
    untestable: Criterion[];
    ambiguities: string[];
    related: RelatedItem[];
    unresolved_links: string[];
    ready: boolean;
}
/** Story readiness: criteria present and testable, links recorded, ambiguities listed. */
export declare function assessReadiness(unitDir: string | null): Readiness & {
    requirement: Requirement | null;
};
/** Ghostwritten clarification question for the ticket author. */
export declare function renderClarification(id: string, r: Readiness): string;
export declare const render: BriefRenderer;
