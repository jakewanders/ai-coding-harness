/** `~/.harness/.env` under HARNESS_HOME (or the OS home). */
export declare function dotenvPath(env?: NodeJS.ProcessEnv): string;
/**
 * Minimal dotenv reader: `KEY=value` lines, optional `export`, `#` comments,
 * single or double quotes stripped. Missing or unreadable file → {}.
 */
export declare function loadDotenv(file: string): Record<string, string>;
