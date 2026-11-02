import fs from 'node:fs';
import path from 'node:path';
import { dotenvPath, loadDotenv } from '../config/dotenv.js';
import { credentialNames, selectEnvironment } from '../config/environments.js';
import { inferProfile } from '../config/infer.js';
import { parseRequirement } from '../spec/requirement.js';
import { stageBrief } from './_shared.js';
export const info = {
    name: 'walkthrough',
    purpose: 'Validate the change in a browser against the acceptance criteria when the repo declares browser_ui.',
    roles: ['codehost'],
    outputs: ['browser_findings evidence with a result per criterion', 'annotated screenshots attached to the PR when the codehost role allows'],
    sections: ['commands'],
    calls: (id) => [
        `exec run { "id": "${id}", "name": "boot" }`,
        `exec run { "id": "${id}", "name": "e2e" }`,
        `evidence record { "id": "${id}", "kind": "browser_findings", "payload": { "criteria": [{ "id": "AC-1", "result": "pass", "notes": "<what you saw>", "screenshots": [] }], "runtime_errors": [], "e2e": { "command": "<e2e command>", "exit": 0 }, "out_of_scope": [] } }`,
        `evidence check { "id": "${id}", "gate": "walkthrough_done" }`,
    ],
};
function e2eCommand(ctx) {
    const repo = ctx.state?.repo ?? ctx.header.repo;
    const configured = ctx.config.config.repos?.[repo]?.commands?.e2e?.trim();
    if (configured)
        return configured;
    const dir = ctx.state?.worktree ?? ctx.cwd ?? null;
    return dir ? inferProfile(dir).guesses.find((g) => g.field === 'commands.e2e')?.value ?? null : null;
}
function walkthroughBody(ctx) {
    const lines = [];
    const reqFile = ctx.unitDir ? path.join(ctx.unitDir, 'requirement.md') : null;
    const criteria = reqFile && fs.existsSync(reqFile) ? parseRequirement(fs.readFileSync(reqFile, 'utf8')).criteria : [];
    lines.push('## Walkthrough', '');
    if (!criteria.length)
        lines.push('No acceptance criteria recorded; walkthrough cannot proceed without them (spec criteria).');
    for (const c of criteria) {
        lines.push(`- ${c.id}: ${c.text}`, `  - Edge cases: derive at least two from this criterion (empty state, boundary value, permission denied, slow network, repeat action) and exercise each one.`);
    }
    const dotenv = loadDotenv(dotenvPath(process.env));
    const sut = selectEnvironment(ctx.config.config, 'sut');
    const reference = selectEnvironment(ctx.config.config, 'reference');
    lines.push('', '## Environments', '');
    if (sut) {
        const names = credentialNames(sut, dotenv);
        lines.push(`- sut: ${sut.name} at ${sut.url ?? '(no url)'}. Credentials are named by env var${names.length ? `: ${names.join(', ')}` : ` with prefix ${sut.env_prefix ?? '(none)'}`}; read them from ~/.harness/.env yourself, never paste values anywhere.`);
    }
    else {
        lines.push('- sut: no environment with role sut is configured; ask the user for a url or boot the app locally with the boot command.');
    }
    lines.push(reference ? `- reference: ${reference.name} at ${reference.url ?? '(no url)'} — reproduce runtime errors here before calling them regressions.` : '- reference: none configured; runtime errors cannot be cross-checked against a reference environment.');
    const e2e = e2eCommand(ctx);
    lines.push('', '## End-to-end suite', '', e2e ? `Run the project's e2e suite through exec run (\`${e2e}\`) and record its exit in browser_findings.e2e.` : 'No e2e command configured or inferable; set e2e: null in browser_findings and say so.');
    lines.push('', '## Screenshots', '', 'Take an annotated screenshot per criterion. Attach them to the PR through the codehost role\'s attach tools when that role is wired; otherwise keep the paths in browser_findings.criteria[].screenshots and say the attachment was skipped.');
    lines.push('', '## Scope', '', 'No roaming regression sweeps. Anything you notice outside the criteria goes into browser_findings.out_of_scope; it is recorded but cannot affect the verdict. Only the per-criterion results decide the walkthrough_done gate.');
    return lines;
}
export const render = (ctx) => stageBrief(info, ctx, walkthroughBody(ctx));
