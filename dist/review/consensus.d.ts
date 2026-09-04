export type ScreenDimension = 'technical' | 'product';
export type ScreenModel = 'primary' | 'second';
export type ScreenCall = 'valid' | 'invalid' | 'unclear';
export interface ScreenVerdict {
    dimension: ScreenDimension;
    model: ScreenModel;
    verdict: ScreenCall;
    reasons: string[];
}
export interface Consensus {
    verdict: ScreenCall;
    /** Share of the present calls that agree with the consensus call; missing slots are listed in dissent instead. */
    agreement: number;
    /** Disagreeing or missing slots, `dimension/model: verdict — reasons`. */
    dissent: string[];
}
export declare const SCREEN_SLOTS: Array<[ScreenDimension, ScreenModel]>;
/**
 * Computed consensus over the four structured calls (latest record per slot):
 * unanimous → that verdict; any `invalid` alongside a `valid`, or any `unclear`
 * → unclear. Missing slots are listed as dissent and count against agreement.
 */
export declare function consensus(records: ScreenVerdict[]): Consensus;
