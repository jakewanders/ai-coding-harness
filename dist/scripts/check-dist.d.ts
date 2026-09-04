export interface DistCheck {
    fresh: boolean;
    differences: string[];
}
/** Build src/ into a temp directory and diff it against the committed dist/. */
export declare function checkDist(root: string): DistCheck;
