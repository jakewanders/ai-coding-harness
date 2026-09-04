export interface Criterion {
    id: string;
    text: string;
}
export interface Requirement {
    title: string;
    url: string | null;
    body: string;
    criteria: Criterion[];
}
export interface RelatedItem {
    kind: 'parent' | 'sibling' | 'linked' | 'pr';
    ref: string;
    title: string | null;
    note: string | null;
}
export declare const CRITERIA_HEADING = "## Acceptance criteria";
/** Number criteria texts as AC-1… */
export declare function numberCriteria(texts: string[]): Criterion[];
/** requirement.md: title, optional source line, body, then the criteria section. */
export declare function renderRequirement(req: Requirement): string;
export declare function parseRequirement(md: string): Requirement;
/** related.md: one bullet per item, `- <kind>: <ref> — <title> (<note>)`. */
export declare function renderRelated(items: RelatedItem[]): string;
export declare function parseRelated(md: string): RelatedItem[];
