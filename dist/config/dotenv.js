import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
/** `~/.harness/.env` under HARNESS_HOME (or the OS home). */
export function dotenvPath(env = process.env) {
    return path.join(env.HARNESS_HOME || os.homedir(), '.harness', '.env');
}
/**
 * Minimal dotenv reader: `KEY=value` lines, optional `export`, `#` comments,
 * single or double quotes stripped. Missing or unreadable file → {}.
 */
export function loadDotenv(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    }
    catch {
        return {};
    }
    const out = {};
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#'))
            continue;
        const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (!m)
            continue;
        let value = m[2].trim();
        const quoted = /^(["'])(.*)\1\s*$/.exec(value);
        if (quoted)
            value = quoted[2];
        else
            value = value.replace(/\s+#.*$/, '').trim();
        out[m[1]] = value;
    }
    return out;
}
