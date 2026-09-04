import fs from 'node:fs';
import path from 'node:path';
export const HISTORY_FILE = 'history.md';
/** Append `- <ISO timestamp> <line>` to the unit's history.md, creating it if needed. */
export function appendHistory(dir, line, now = () => new Date()) {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, HISTORY_FILE), `- ${now().toISOString()} ${line}\n`);
}
