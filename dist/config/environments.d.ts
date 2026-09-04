import type { EnvironmentConfig, HarnessConfig } from './schema.js';
export type EnvironmentRole = 'sut' | 'reference' | 'production';
export type Environment = EnvironmentConfig;
/** The first configured environment with the given role, regardless of list order or name. */
export declare function selectEnvironment(config: HarnessConfig, role: EnvironmentRole): Environment | null;
/** Variables from the dotenv whose names start with the environment's prefix. */
export declare function credentialsFor(env: Environment, dotenv: Record<string, string>): Record<string, string>;
/** Credential variable names only; values never leave the process. */
export declare function credentialNames(env: Environment, dotenv: Record<string, string>): string[];
