import fs from 'node:fs';
import path from 'node:path';
import { migrate } from './migrations.js';
import { expandHome, homeRelative } from './paths.js';
import { STATE_SCHEMA, UnitStateSchema } from './schema.js';
export { STATE_SCHEMA };
export { appendHistory } from './history.js';
export const STATE_FILE = 'state.json';
export function createState(init, now = () => new Date()) {
    const at = now().toISOString();
    return {
        schema: STATE_SCHEMA,
        id: init.id,
        repo: init.repo,
        tracked: init.tracked,
        source: { ...init.source },
        mode: init.mode,
        stage: 'define',
        cycle: 0,
        kind: 'unknown',
        worktree: null,
        branch: null,
        base_branch: init.base_branch,
        evidence: [],
        commits: [],
        runs: [],
        pr: null,
        timers: [],
        answers: {},
        challenge_passed: false,
        created_at: at,
        updated_at: at,
    };
}
function statePath(dir) {
    return path.join(dir, STATE_FILE);
}
/** Read state.json, migrating an old schema in memory and writing it back. */
export function readState(dir) {
    const raw = JSON.parse(fs.readFileSync(statePath(dir), 'utf8'));
    const needsRewrite = !(typeof raw === 'object' && raw !== null && raw.schema === STATE_SCHEMA);
    const migrated = migrate(raw);
    const state = { ...migrated, worktree: migrated.worktree ? expandHome(migrated.worktree) : null };
    if (needsRewrite)
        writeState(dir, state, () => new Date(state.updated_at));
    return state;
}
/** Validate and write state.json with home-relative paths and a fresh updated_at. */
export function writeState(dir, s, now = () => new Date()) {
    const serial = {
        ...s,
        updated_at: now().toISOString(),
        worktree: s.worktree ? homeRelative(s.worktree) : null,
    };
    UnitStateSchema.parse(serial);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statePath(dir), JSON.stringify(serial, null, 2) + '\n');
}
