import type { HarnessConfig } from '../config/schema.js';
import type { ModeDef } from '../modes.js';
export interface ReviewColumnDef {
    id: string;
    describe: string;
    /** Repo capability the column needs. */
    requires?: string;
}
/** The six lean review columns. */
export declare const REVIEW_COLUMNS: ReviewColumnDef[];
export interface RequiredColumnsInput {
    config: HarnessConfig;
    repo: string;
    mode?: ModeDef;
}
/** Columns a synthesized verdict needs: every column whose capability requirement is met. */
export declare function requiredColumns({ config, repo }: RequiredColumnsInput): string[];
