import type { HarnessConfig } from '../config/schema.js';
import type { ModeDef } from '../modes.js';
export interface ReviewColumnDef {
    id: string;
    describe: string;
    /** Capability (or the `counterweight` seat) the column needs. */
    requires?: string;
}
/** The thirteen review columns from spec section 8. */
export declare const REVIEW_COLUMNS: ReviewColumnDef[];
export interface RequiredColumnsInput {
    config: HarnessConfig;
    repo: string;
    mode: ModeDef;
}
/**
 * Columns a synthesized verdict needs: every column whose requirement is met.
 * The counterweight column is required only when its seat is wired and the
 * mode keeps counterweight_consulted at block.
 */
export declare function requiredColumns({ config, repo, mode }: RequiredColumnsInput): string[];
