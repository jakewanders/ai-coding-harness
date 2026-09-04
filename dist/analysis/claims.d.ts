export type ClaimNeed = 'test' | 'run' | 'screenshot' | 'link';
export interface Claim {
    text: string;
    needs: ClaimNeed;
}
/** Split prose into sentences and bullet items. */
export declare function sentences(text: string): string[];
/** Sentences that assert an outcome, each with the kind of proof it needs. */
export declare function claimsAudit(text: string): Claim[];
