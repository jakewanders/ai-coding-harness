import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { inferProfile } from '../config/infer.js';
import { envelope } from '../contracts/envelope.js';
import { runCommand, tailLines } from '../exec/run.js';
import { action, defineTool, fail, result } from '../registry/tools.js';
import { expandHome, homeRelative } from '../store/paths.js';
import { appendHistory, writeState } from '../store/state.js';
import { loadUnit } from '../store/units.js';
export const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
export const SUMMARY_LINES = 20;
/** Configured commands for the unit's repo, else inferred ones flagged as such. */
export function profileCommands(ctx, unit) {
    const configured = (ctx.config.config.repos?.[unit.state.repo]?.commands ?? {});
    const commands = Object.fromEntries(Object.entries(configured).filter(([, v]) => typeof v === 'string' && v.trim() !== ''));
    if (Object.keys(commands).length)
        return { commands, inferred: false, evidence: {} };
    const inferred = {};
    const evidence = {};
    for (const g of inferProfile(unit.state.worktree ?? ctx.cwd).guesses) {
        if (!g.field.startsWith('commands.'))
            continue;
        const name = g.field.slice('commands.'.length);
        inferred[name] = g.value;
        evidence[name] = g.evidence;
    }
    return { commands: inferred, inferred: true, evidence };
}
function runId(now, label) {
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    return `${stamp}-${label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 20) || 'cmd'}-${randomBytes(2).toString('hex')}`;
}
function needUnit(ctx, id) {
    return loadUnit(ctx, id);
}
const runSchema = z
    .object({
    id: z.string().describe('Unit id.'),
    name: z.string().optional().describe('Profile command name (check, test, lint, typecheck, e2e, boot, install).'),
    command: z.string().optional().describe('Raw shell command to run instead of a named one.'),
    timeoutMs: z.number().int().positive().optional().describe('Kill the command after this many milliseconds (default 10 minutes).'),
})
    .refine((v) => (v.name === undefined) !== (v.command === undefined), { message: 'provide exactly one of name or command', path: ['name'] });
export const execTool = defineTool({
    name: 'exec',
    description: 'Run profile or ad-hoc commands for a unit with full logs kept under runs/ and a summary in state.',
    actions: {
        commands: action({
            describe: "List the repo profile commands for the unit's repo, inferred with evidence when nothing is configured.",
            schema: z.object({ id: z.string().describe('Unit id.') }),
            handler: async (input, ctx) => {
                const unit = needUnit(ctx, input.id);
                if (!unit)
                    return fail(`unit "${input.id}" not found in the current namespace`);
                const p = profileCommands(ctx, unit);
                const names = Object.keys(p.commands);
                const lines = names.length
                    ? names.map((n) => `- ${n}: \`${p.commands[n]}\`${p.inferred ? ` (inferred: ${p.evidence[n]})` : ''}`)
                    : ['No commands configured or inferable for this repo.'];
                return result(lines.join('\n'), envelope(true, `${names.length} command(s)${p.inferred ? ', inferred' : ''}`, { id: unit.id, repo: unit.state.repo, ...p }));
            },
        }),
        run: action({
            describe: 'Run a named profile command or a raw command in the unit worktree; records exit, summary and log path.',
            schema: runSchema,
            handler: async (input, ctx) => {
                const unit = needUnit(ctx, input.id);
                if (!unit)
                    return fail(`unit "${input.id}" not found in the current namespace`);
                let command = input.command;
                if (input.name !== undefined) {
                    const p = profileCommands(ctx, unit);
                    command = p.commands[input.name];
                    if (!command)
                        return fail(`exec run: no command named "${input.name}" for ${unit.state.repo}; known: ${Object.keys(p.commands).join(', ') || 'none'}`);
                }
                const cwd = unit.state.worktree ?? ctx.cwd;
                const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
                const started = ctx.now();
                const id = runId(started, input.name ?? 'cmd');
                const out = await runCommand(command, { cwd, timeoutMs });
                const ended = ctx.now();
                const combined = [out.stdout.trimEnd(), out.stderr.trimEnd()].filter(Boolean).join('\n');
                const summaryTail = tailLines(combined, SUMMARY_LINES);
                const summary = out.timedOut ? `timed out after ${timeoutMs}ms\n${summaryTail}`.trim() : summaryTail;
                const logAbs = path.join(unit.dir, 'runs', `${id}.log`);
                fs.mkdirSync(path.dirname(logAbs), { recursive: true });
                const logLines = [
                    `$ ${command}`, `cwd: ${cwd}`, `started: ${started.toISOString()}`, `ended: ${ended.toISOString()}`,
                    `exit: ${out.exit}${out.timedOut ? ' (timed out)' : ''}`, '', '--- stdout ---', out.stdout.trimEnd(),
                ];
                if (out.stderr.trim())
                    logLines.push('--- stderr ---', out.stderr.trimEnd());
                fs.writeFileSync(logAbs, logLines.join('\n') + '\n');
                const log = homeRelative(logAbs);
                const record = { id, command: command, exit: out.exit, summary, log, started_at: started.toISOString(), ended_at: ended.toISOString() };
                writeState(unit.dir, { ...unit.state, runs: [...unit.state.runs, record] }, ctx.now);
                appendHistory(unit.dir, `run ${id}: ${command} -> exit ${out.exit}${out.timedOut ? ' (timed out)' : ''}`, ctx.now);
                const ok = out.exit === 0 && !out.timedOut;
                const head = ok ? `Run ${id} passed (exit 0).` : out.timedOut ? `Run ${id} timed out after ${timeoutMs}ms.` : `Run ${id} failed (exit ${out.exit}).`;
                const text = `${head}\nlog: ${log}\n\n${summaryTail || '(no output)'}`;
                return result(text, envelope(ok, ok ? `exit 0` : out.timedOut ? 'timed out' : `exit ${out.exit}`, { id: unit.id, run: id, command, exit: out.exit, timedOut: out.timedOut, summary, log }));
            },
        }),
        logs: action({
            describe: 'Return the full log of a recorded run, or its last N lines.',
            schema: z.object({
                id: z.string().describe('Unit id.'),
                run: z.string().describe('Run id as returned by exec run.'),
                tail: z.number().int().positive().optional().describe('Only the last N lines.'),
            }),
            handler: async (input, ctx) => {
                const unit = needUnit(ctx, input.id);
                if (!unit)
                    return fail(`unit "${input.id}" not found in the current namespace`);
                const record = unit.state.runs.find((r) => r.id === input.run);
                if (!record)
                    return fail(`exec logs: no run "${input.run}" for ${unit.id}; known: ${unit.state.runs.map((r) => r.id).join(', ') || 'none'}`);
                const file = expandHome(record.log);
                if (!fs.existsSync(file))
                    return fail(`exec logs: log file missing at ${record.log}`);
                const full = fs.readFileSync(file, 'utf8');
                const text = input.tail ? tailLines(full, input.tail) : full;
                return result(text, envelope(true, `log for ${input.run}`, { id: unit.id, run: input.run, exit: record.exit, log: record.log, lines: text.split('\n').length }));
            },
        }),
    },
});
