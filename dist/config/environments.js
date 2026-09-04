/** The first configured environment with the given role, regardless of list order or name. */
export function selectEnvironment(config, role) {
    return (config.environments ?? []).find((e) => e.role === role) ?? null;
}
/** Variables from the dotenv whose names start with the environment's prefix. */
export function credentialsFor(env, dotenv) {
    const prefix = env.env_prefix;
    if (!prefix)
        return {};
    return Object.fromEntries(Object.entries(dotenv).filter(([k]) => k.startsWith(prefix)));
}
/** Credential variable names only; values never leave the process. */
export function credentialNames(env, dotenv) {
    return Object.keys(credentialsFor(env, dotenv)).sort();
}
