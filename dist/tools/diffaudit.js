import fs from 'node:fs';
import { z } from 'zod';
import { parseDiff } from '../analysis/diff-parse.js';
import { envelope } from '../contracts/envelope.js';
import { loadRules, runRules } from '../diffaudit/rules.js';
import '../gates/index.js';
import { baseRefFor, diffAgainst, fetchOrigin } from '../git/diff.js';
import { gitRoot } from '../git/exec.js';
import { action, defineTool, fail, result } from '../registry/tools.js';
import { appendHistory, writeState } from '../store/state.js';
import { loadUnit } from '../store/units.js';
function withUnit(ctx, id, fn) {
    const unit = loadUnit(ctx, id);
    if (!unit)
        return fail(`unit "${id}" not found in the current namespace`);
    const worktree = unit.state.worktree && fs.existsSync(unit.state.worktree) ? unit.state.worktree : gitRoot(ctx.cwd) ?? ctx.cwd;
    return fn(unit, worktree);
}
function diffFor(given, unit, worktree) {
    if (given !== undefined)
        return parseDiff(given);
    const fetched = fetchOrigin(worktree);
    if (!fetched.ok)
        return { error: `fetch failed: ${fetched.detail}` };
    const base = baseRefFor(worktree, unit.state.base_branch);
    if ('error' in base)
        return { error: base.error };
    const d = diffAgainst(worktree, base.ref, false);
    if ('error' in d)
        return { error: d.error };
    return parseDiff(d.text);
}
export const diffauditTool = defineTool({
    name: 'diffaudit',
    description: 'Configured and kit diff-audit rules run over added lines; results are recorded as the diffaudit review column.',
    actions: {
        run: action({
            describe: 'Run every rule over the diff (default: worktree vs remote base) and record the diffaudit review column.',
            schema: z.object({ id: z.string().describe('Unit id.'), diff: z.string().optional().describe('Unified diff; defaults to the worktree against the remote base.') }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit, worktree) => {
                const diff = diffFor(input.diff, unit, worktree);
                if ('error' in diff)
                    return fail(`diffaudit run: ${diff.error}`);
                const rules = loadRules(ctx.config.config);
                const findings = runRules(rules, diff);
                const column = { column: 'diffaudit', findings: findings.map((f) => ({ severity: f.severity, text: f.text, path: f.path, line: f.line })) };
                const record = { kind: 'review_column', cycle: unit.state.cycle, recorded_at: ctx.now().toISOString(), payload: column };
                writeState(unit.dir, { ...unit.state, evidence: [...unit.state.evidence, record] }, ctx.now);
                appendHistory(unit.dir, `diffaudit: ${findings.length} finding(s) from ${rules.length} rule(s)`, ctx.now);
                const serious = findings.filter((f) => f.severity === 'blocker' || f.severity === 'major').length;
                const text = findings.length ? findings.map((f) => `- [${f.severity}] ${f.path}:${f.line} ${f.text}`).join('\n') : `No findings from ${rules.length} rule(s).`;
                return result(text, envelope(serious === 0, `${findings.length} finding(s), ${serious} serious`, { id: unit.id, rules: rules.length, findings }));
            }),
        }),
        rules: action({
            describe: 'List the diff-audit rules in effect for this repo (config plus kits).',
            schema: z.object({ id: z.string().describe('Unit id.') }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                const rules = loadRules(ctx.config.config);
                const text = rules.length ? rules.map((r) => `- ${r.id} [${r.severity}] ${r.files}: /${r.pattern}/ — ${r.message}`).join('\n') : 'No diff-audit rules configured.';
                return result(text, envelope(true, `${rules.length} rule(s)`, { id: unit.id, rules }));
            }),
        }),
    },
});
