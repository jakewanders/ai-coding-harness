/** File paths a plan intends to touch: backticked paths and `Files:` lines. */
export declare function predictFiles(plan: string): string[];
/** |A ∩ B| / |A ∪ B|; 0 when both are empty. */
export declare function jaccard(a: string[], b: string[]): number;
export declare const OVERLAP_THRESHOLD = 0.2;
/** Union-find grouping of units whose predicted files overlap at or above the threshold; groups keep input order. */
export declare function cluster(units: Array<{
    id: string;
    files: string[];
}>, threshold?: number): string[][];
