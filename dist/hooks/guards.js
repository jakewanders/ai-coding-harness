import fs from 'node:fs';
import path from 'node:path';
import { parseDiff } from '../analysis/diff-parse.js';
import { piiAudit } from '../analysis/pii.js';
import { loadConfig } from '../config/load.js';
import '../gates/index.js';
import { isProtected } from '../git/diff.js';
import { currentBranch, git, gitRoot } from '../git/exec.js';
import { resolveMode, UnknownModeError } from '../modes.js';
import { resolveGates, transitionAllowed } from '../registry/gates.js';
import { nextStageFor } from '../registry/stages.js';
import { vaultRoot } from '../store/paths.js';
import { resolveUnitRecord } from './resolve-unit.js';
export const OVERSIZE_BYTES = 5 * 1024 * 1024;
const GIT_COMMIT = /\bgit\b[^|;&]*\bcommit\b/;
const GIT_PUSH = /\bgit\b[^|;&]*\bpush\b/;
const PR_CREATE = /\b(pr|pull-request|pull_request|merge-request|mr)\s+create\b|\bpull-request\b|\bmerge-request\b/;
const UNIT_ADVANCE = /\bunit\s+advance\b/;
const PEM = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const KEY_ASSIGNMENT = /\b(api[_-]?key|secret|token|password|passwd|pwd|private[_-]?key|access[_-]?key)\b[^\n]{0,40}[=:]\s*['"`]?([A-Za-z0-9_\-/+=.]{20,})/i;
const LONG_TOKEN = /\b(?:[A-Fa-f0-9]{40,}|[A-Za-z0-9+/]{40,}={0,2})\b/;
const KEY_WORDS = /\b(key|secret|token|password|passwd|credential)\b/i;
function stagedDiff(ctx) {
    if (ctx.staged === null) {
        const r = ctx.root ? git(['diff', '--cached', '--unified=0'], ctx.root) : { ok: false, stdout: '' };
        ctx.staged = r.ok ? r.stdout : '';
    }
    return ctx.staged;
}
function modeFor(ctx) {
    const name = ctx.unit?.state.mode ?? 'thorough';
    try {
        return resolveMode(name, ctx.config.config);
    }
    catch (e) {
        if (e instanceof UnknownModeError)
            return resolveMode('thorough', ctx.config.config);
        throw e;
    }
}
async function gatesFor(ctx, stage) {
    const unit = ctx.unit;
    return resolveGates(stage, { state: unit.state, config: ctx.config.config, unitDir: unit.dir, worktree: unit.state.worktree, cwd: ctx.payload.cwd, vault: ctx.vault }, modeFor(ctx));
}
function gateLines(gates) {
    return gates.map((g) => `- ${g.id} [${g.severity}] ${g.status}${g.remedy ? ` — ${g.remedy}` : ''}`);
}
const noBypassFlags = ({ command }) => {
    if (GIT_COMMIT.test(command) && /\s--no-(verify|gpg-sign)\b/.test(command)) {
        return { id: 'no_bypass_flags', outcome: 'block', message: 'verification bypass flags (--no-verify, --no-gpg-sign) are not allowed on git commit' };
    }
    if (GIT_PUSH.test(command) && /\s(--force|-f)\b/.test(command) && !/--force-with-lease/.test(command)) {
        return { id: 'no_bypass_flags', outcome: 'block', message: 'force pushes must use --force-with-lease' };
    }
    return { id: 'no_bypass_flags', outcome: GIT_COMMIT.test(command) || GIT_PUSH.test(command) ? 'pass' : 'silent' };
};
const protectedBranch = (ctx) => {
    const { command } = ctx;
    if (!GIT_PUSH.test(command))
        return { id: 'protected_branch', outcome: 'silent' };
    const explicit = /\bpush\b(?:\s+(?:--\S+|-\w))*\s+\S+\s+(?:\S+:)?([^\s:]+)/.exec(command)?.[1];
    const target = explicit ?? (ctx.root ? currentBranch(ctx.root) : null);
    if (!target)
        return { id: 'protected_branch', outcome: 'pass' };
    const patterns = ctx.config.config.protected_branches ?? [];
    if (!isProtected(target, patterns))
        return { id: 'protected_branch', outcome: 'pass' };
    const override = ctx.deps.env.HARNESS_ALLOW_PROTECTED === '1' || /#\s*harness:\s*allow-protected/.test(command);
    if (override)
        return { id: 'protected_branch', outcome: 'warn', message: `pushing to protected branch ${target} with an explicit override` };
    return { id: 'protected_branch', outcome: 'block', message: `push to protected branch "${target}" refused (protected_branches: ${patterns.join(', ')}); set HARNESS_ALLOW_PROTECTED=1 or append "# harness: allow-protected" if this is intended` };
};
const credentialScan = (ctx) => {
    if (!GIT_COMMIT.test(ctx.command))
        return { id: 'credential_scan', outcome: 'silent' };
    const hits = [];
    for (const file of parseDiff(stagedDiff(ctx))) {
        for (const { line, text } of file.added) {
            if (PEM.test(text) || KEY_ASSIGNMENT.test(text) || (LONG_TOKEN.test(text) && KEY_WORDS.test(text)))
                hits.push(`${file.path}:${line}`);
        }
    }
    if (!hits.length)
        return { id: 'credential_scan', outcome: 'pass' };
    return { id: 'credential_scan', outcome: 'block', message: `credential-shaped content staged at ${hits.join(', ')}; move secrets to ~/.harness/.env or the host's secret store and unstage the file` };
};
const oversizeFile = (ctx) => {
    if (!GIT_COMMIT.test(ctx.command) || !ctx.root)
        return { id: 'oversize_file', outcome: 'silent' };
    const r = git(['diff', '--cached', '--name-only', '--diff-filter=AM'], ctx.root);
    if (!r.ok)
        return { id: 'oversize_file', outcome: 'pass' };
    const big = r.stdout.split('\n').filter(Boolean).filter((rel) => {
        try {
            return fs.statSync(path.join(ctx.root, rel)).size > OVERSIZE_BYTES;
        }
        catch {
            return false;
        }
    });
    if (!big.length)
        return { id: 'oversize_file', outcome: 'pass' };
    return { id: 'oversize_file', outcome: 'block', message: `staged file(s) over ${OVERSIZE_BYTES / 1024 / 1024} MB: ${big.join(', ')}; unstage them or use large-file storage` };
};
const piiSinkWarn = (ctx) => {
    if (!GIT_COMMIT.test(ctx.command))
        return { id: 'pii_sink_warn', outcome: 'silent' };
    const findings = piiAudit(parseDiff(stagedDiff(ctx)));
    if (!findings.length)
        return { id: 'pii_sink_warn', outcome: 'pass' };
    return { id: 'pii_sink_warn', outcome: 'warn', message: `personal data heading to a sink in staged lines: ${findings.map((f) => `${f.file}:${f.line} [${f.sink}]`).join(', ')}; record a pii audit or waiver before committing` };
};
const commitGate = async (ctx) => {
    if (!GIT_COMMIT.test(ctx.command) || !ctx.unit)
        return { id: 'commit_gate', outcome: 'silent' };
    const gates = await gatesFor(ctx, 'build');
    const verdict = transitionAllowed(gates);
    if (verdict.ok)
        return { id: 'commit_gate', outcome: 'pass' };
    return { id: 'commit_gate', outcome: 'block', message: [`build gates failing for ${ctx.unit.id}:`, ...gateLines(verdict.blocking)].join('\n') };
};
const publishGate = async (ctx) => {
    if (!(GIT_PUSH.test(ctx.command) || PR_CREATE.test(ctx.command)) || !ctx.unit)
        return { id: 'publish_gate', outcome: 'silent' };
    const gates = await gatesFor(ctx, 'publish');
    const verdict = transitionAllowed(gates);
    if (verdict.ok)
        return { id: 'publish_gate', outcome: 'pass' };
    return { id: 'publish_gate', outcome: 'block', message: [`publish gates failing for ${ctx.unit.id}:`, ...gateLines(verdict.blocking)].join('\n') };
};
const transitionPreview = async (ctx) => {
    if (!UNIT_ADVANCE.test(ctx.command) || !ctx.unit)
        return { id: 'transition_preview', outcome: 'silent' };
    const mode = modeFor(ctx);
    const stage = ctx.unit.state.stage;
    const gates = await gatesFor(ctx, stage);
    const next = nextStageFor(stage, { skip: mode.skip_stages, browserUi: Boolean(ctx.config.config.repos?.[ctx.unit.state.repo]?.capabilities?.browser_ui) });
    return { id: 'transition_preview', outcome: 'warn', message: [`${ctx.unit.id}: leaving ${stage}${next ? ` for ${next}` : ''} depends on:`, ...(gates.length ? gateLines(gates) : ['- no gates'])].join('\n') };
};
const GUARDS = [noBypassFlags, protectedBranch, credentialScan, oversizeFile, piiSinkWarn, commitGate, publishGate, transitionPreview];
function buildCtx(payload, deps) {
    const root = gitRoot(payload.cwd);
    const config = deps.config ?? loadConfig({ cwd: payload.cwd, env: deps.env });
    const vault = deps.vault ?? vaultRoot(deps.env, config.config.store?.path);
    const unit = root ? resolveUnitRecord(payload.cwd, vault) : null;
    return { payload, deps, command: payload.command ?? '', root, config, vault, unit, staged: null };
}
/** Run every pre-bash guard in order; any block wins, warnings are collected. */
export async function runPreBash(payload, deps) {
    const ctx = buildCtx(payload, deps);
    const guards = [];
    for (const guard of GUARDS) {
        try {
            guards.push(await guard(ctx));
        }
        catch (e) {
            guards.push({ id: guard.name || 'guard', outcome: 'warn', message: `guard failed: ${e instanceof Error ? e.message : String(e)}` });
        }
    }
    const messages = guards.filter((g) => g.message && (g.outcome === 'block' || g.outcome === 'warn')).map((g) => `${g.id}: ${g.message}`);
    return { block: guards.some((g) => g.outcome === 'block'), messages, guards };
}
/** Stop hook: the one-line status of the unit implied by the branch, or nothing. */
export async function runStop(payload, deps) {
    const ctx = buildCtx(payload, deps);
    if (!ctx.unit)
        return { message: '' };
    const s = ctx.unit.state;
    return { message: `${s.id} · ${s.stage} · cycle ${s.cycle} · ${s.mode} · ${s.branch ?? 'no branch'}` };
}
