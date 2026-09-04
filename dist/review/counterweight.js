import { dotenvPath, loadDotenv } from '../config/dotenv.js';
import { runCommand } from '../exec/run.js';
export const API_KEY_VAR = 'COUNTERWEIGHT_API_KEY';
export const CLI_TIMEOUT_MS = 5 * 60 * 1000;
export const STUB_TEXT = [
    'provider: fallback-stub',
    '',
    'No independent second-opinion model is configured (seats.counterweight.cli or .http with a key in ~/.harness/.env).',
    'This is the same model reviewing its own work; treat the findings as a self-review, not a second opinion.',
].join('\n');
/** Configured CLI → HTTP endpoint (key from dotenv or env) → same-model stub that declares itself. */
export function resolveCounterweight(config, env, deps = {}) {
    const seat = config.seats?.counterweight;
    const exec = deps.exec ?? runCommand;
    if (seat?.cli) {
        const cli = seat.cli;
        return {
            kind: 'cli',
            describe: () => `cli: ${cli}`,
            review: async (prompt) => {
                const r = await exec(cli, { cwd: process.cwd(), timeoutMs: CLI_TIMEOUT_MS, env: { COUNTERWEIGHT_PROMPT: prompt } });
                if (r.timedOut)
                    throw new Error(`counterweight cli timed out after ${CLI_TIMEOUT_MS}ms`);
                if (r.exit !== 0)
                    throw new Error(`counterweight cli exited ${r.exit}: ${r.stderr || r.stdout}`);
                return r.stdout.trim();
            },
        };
    }
    const key = env[API_KEY_VAR] ?? loadDotenv(dotenvPath(env))[API_KEY_VAR];
    if (seat?.http && key) {
        const url = seat.http;
        const fetchImpl = deps.fetch ?? globalThis.fetch;
        return {
            kind: 'http',
            describe: () => `http: ${url}`,
            review: async (prompt) => {
                const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ prompt }) });
                const text = await res.text();
                if (!res.ok)
                    throw new Error(`counterweight http ${res.status}: ${text.slice(0, 200)}`);
                return text;
            },
        };
    }
    return { kind: 'fallback-stub', describe: () => 'fallback-stub (same model, declared)', review: async () => STUB_TEXT };
}
/** `severity:` plus the first three words of the text, lowercased and stripped of punctuation. */
export function classOf(f) {
    const words = f.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 3);
    return `${f.severity}:${words.join(' ')}`;
}
/**
 * Track finding classes across cycles: a class seen more than `cap` times
 * (previous records plus now) is reported as capped and dropped from active.
 */
export function trackFindings(previous, current, cap = 3) {
    const seen = new Map();
    for (const rec of previous) {
        const classes = new Set(rec.findings.map(classOf));
        for (const c of classes)
            seen.set(c, (seen.get(c) ?? 0) + 1);
    }
    const active = [];
    const capped = new Map();
    for (const f of current) {
        const cls = classOf(f);
        const count = (seen.get(cls) ?? 0) + 1;
        if (count > cap)
            capped.set(cls, count);
        else
            active.push({ ...f, class: cls });
    }
    return { active, capped: [...capped.entries()].map(([cls, count]) => ({ class: cls, count })) };
}
