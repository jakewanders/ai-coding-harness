import type { EnvironmentConfig, HarnessConfig } from './schema.js';

export type EnvironmentRole = 'sut' | 'reference' | 'production';
export type Environment = EnvironmentConfig;

/** The first configured environment with the given role, regardless of list order or name. */
export function selectEnvironment(config: HarnessConfig, role: EnvironmentRole): Environment | null {
  return (config.environments ?? []).find((e) => e.role === role) ?? null;
}

/** Variables from the dotenv whose names start with the environment's prefix. */
export function credentialsFor(env: Environment, dotenv: Record<string, string>): Record<string, string> {
  const prefix = env.env_prefix;
  if (!prefix) return {};
  return Object.fromEntries(Object.entries(dotenv).filter(([k]) => k.startsWith(prefix)));
}

/** Credential variable names only; values never leave the process. */
export function credentialNames(env: Environment, dotenv: Record<string, string>): string[] {
  return Object.keys(credentialsFor(env, dotenv)).sort();
}
