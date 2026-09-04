import { type InferredProfile } from '../config/infer.js';
import { type LoadedConfig } from '../config/load.js';
import type { HarnessConfig } from '../config/schema.js';
import type { ConfigError, SeatName } from '../contracts/header.js';
import type { ToolContext } from '../registry/tools.js';
export interface DoctorReport {
    profile: InferredProfile;
    layers: LoadedConfig['layers'];
    errors: ConfigError[];
    seats: Record<SeatName, string[] | 'unwired'>;
    kits: Array<{
        name: string;
        dir: string;
        docs: number;
        rules: number;
    }>;
    environments: NonNullable<HarnessConfig['environments']>;
    vault: {
        path: string;
        exists: boolean;
        git: boolean;
        remote: string | null;
    };
    build: {
        dist: boolean;
        version: string | null;
        matches: boolean;
    };
    proposed_repo_config: string;
}
/** YAML for a `.harness.yaml` built from the inferred profile. */
export declare function proposeRepoConfig(profile: InferredProfile): string;
/** Read-only health and configuration report for the current checkout. */
export declare function runDoctor(ctx: ToolContext): DoctorReport;
export declare function renderDoctor(r: DoctorReport): string;
/** `key.path → layer` for every leaf of the merged config. */
export declare function provenance(ctx: ToolContext): Record<string, string>;
