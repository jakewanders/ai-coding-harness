import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { claimsAudit } from '../analysis/claims.js';
import { criteriaMap } from '../analysis/criteria-map.js';
import { parseDiff } from '../analysis/diff-parse.js';
import { impactRadius } from '../analysis/impact.js';
import { piiAudit } from '../analysis/pii.js';
import { DEFAULT_SUBJECTS, reachAudit } from '../analysis/reach.js';
import { envelope } from '../contracts/envelope.js';
import '../gates/index.js';
import { baseRefFor, diffAgainst, fetchOrigin } from '../git/diff.js';
import { gitRoot } from '../git/exec.js';
import { action, defineTool, fail, result } from '../registry/tools.js';
import { parseRequirement } from '../spec/requirement.js';
import { appendHistory, writeState } from '../store/state.js';
import { loadUnit } from '../store/units.js';
function withUnit(ctx, id, fn) {
    const unit = loadUnit(ctx, id);
    if (!unit)
        return fail(`unit "${id}" not found in the current namespace`);
    const worktree = unit.state.worktree && fs.existsSync(unit.state.worktree) ? unit.state.worktree : gitRoot(ctx.cwd) ?? ctx.cwd;
    return fn(unit, worktree);
}
/** The given diff, else the working tree against the remote base. */
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
function record(unit, ctx, kind, payload) {
    const rec = { kind, cycle: unit.state.cycle, recorded_at: ctx.now().toISOString(), payload };
    writeState(unit.dir, { ...unit.state, evidence: [...unit.state.evidence, rec] }, ctx.now);
    appendHistory(unit.dir, `analysis recorded: ${kind} (cycle ${unit.state.cycle})`, ctx.now);
}
function gateNext(id, gate) {
    return [{ tool: 'evidence', action: 'check', why: `confirm gate ${gate} for ${id}` }];
}
const diffInput = { id: z.string().describe('Unit id.'), diff: z.string().optional().describe('Unified diff; defaults to the worktree against the remote base.') };
export const analyzeTool = defineTool({
    name: 'analyze',
    description: 'Deterministic analyses over the diff and PR prose; each one records its result as evidence of the matching kind.',
    actions: {
        impact: action({
            describe: 'Impact radius: changed exports and the files importing them; records impact evidence.',
            schema: z.object(diffInput),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit, worktree) => {
                const diff = diffFor(input.diff, unit, worktree);
                if ('error' in diff)
                    return fail(`analyze impact: ${diff.error}`);
                const r = impactRadius(diff, worktree);
                const byFile = new Map();
                for (const e of r.changed_exports)
                    byFile.set(e.file, byFile.get(e.file) ?? new Set());
                for (const c of r.consumers)
                    for (const e of r.changed_exports)
                        if (c.imports.includes(e.name) || c.imports.includes('*'))
                            byFile.get(e.file).add(c.file);
                const changed = [...byFile.entries()].map(([p, consumers]) => ({ path: p, consumers: [...consumers].sort() }));
                const summary = `${r.changed_exports.length} changed export(s) in ${changed.length} file(s); ${r.consumers.length} consumer file(s)`;
                record(unit, ctx, 'impact', { changed, summary });
                const lines = [summary, ...r.changed_exports.map((e) => `- ${e.file}: ${e.name}`), ...(r.consumers.length ? ['consumers:', ...r.consumers.map((c) => `- ${c.file} imports ${c.imports.join(', ')}`)] : [])];
                return result(lines.join('\n'), envelope(true, summary, { id: unit.id, ...r, changed }, gateNext(unit.id, 'impact_recorded')));
            }),
        }),
        pii: action({
            describe: 'Personal-data audit over added lines; records pii evidence (empty findings means clean).',
            schema: z.object(diffInput),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit, worktree) => {
                const diff = diffFor(input.diff, unit, worktree);
                if ('error' in diff)
                    return fail(`analyze pii: ${diff.error}`);
                const findings = piiAudit(diff);
                record(unit, ctx, 'pii', { findings });
                const text = findings.length ? findings.map((f) => `- ${f.file}:${f.line} [${f.sink}] ${f.text}`).join('\n') : 'No personal-data flows found in added lines.';
                return result(text, envelope(findings.length === 0, findings.length ? `${findings.length} pii finding(s)` : 'pii clean', { id: unit.id, findings }, gateNext(unit.id, 'pii_audit_clean')));
            }),
        }),
        claims: action({
            describe: 'Extract assertive claims from PR prose (default: drafts/pr-body.md) and record them as unverified claims evidence.',
            schema: z.object({ id: z.string().describe('Unit id.'), text: z.string().optional().describe('Prose to audit; defaults to drafts/pr-body.md.') }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit) => {
                let text = input.text;
                if (text === undefined) {
                    const draft = path.join(unit.dir, 'drafts', 'pr-body.md');
                    if (!fs.existsSync(draft))
                        return fail('analyze claims: no text given and no drafts/pr-body.md; run pullreq body first');
                    text = fs.readFileSync(draft, 'utf8');
                }
                const claims = claimsAudit(text);
                record(unit, ctx, 'claims', { claims: claims.map((c) => ({ text: c.text, status: 'unverified', evidence: `needs ${c.needs}` })) });
                const lines = claims.length ? claims.map((c) => `- [${c.needs}] ${c.text}`) : ['No assertive claims found.'];
                return result(lines.join('\n'), envelope(true, `${claims.length} claim(s) to verify`, { id: unit.id, claims }, gateNext(unit.id, 'claims_audited')));
            }),
        }),
        reach: action({
            describe: 'Coverage-reach audit: new files, exports and routes and the e2e/mock/contract subject files that mention them; records reach_audit evidence.',
            schema: z.object({
                ...diffInput,
                subjects: z.object({ e2e_globs: z.array(z.string()), mock_globs: z.array(z.string()), contract_globs: z.array(z.string()) }).optional().describe('Subject-list globs; defaults cover common layouts.'),
            }),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit, worktree) => {
                const diff = diffFor(input.diff, unit, worktree);
                if ('error' in diff)
                    return fail(`analyze reach: ${diff.error}`);
                const surfaces = reachAudit(diff, input.subjects ?? DEFAULT_SUBJECTS, worktree);
                const payload = { surfaces: surfaces.map((s) => ({ surface: s.surface, subjects: s.covered_by.map((name, i) => ({ kind: s.covered_kinds[i], name, extended: true })) })) };
                record(unit, ctx, 'reach_audit', payload);
                const uncovered = surfaces.filter((s) => !s.covered_by.length);
                const lines = surfaces.length ? surfaces.map((s) => `- ${s.kind} ${s.surface}: ${s.covered_by.length ? s.covered_by.join(', ') : 'UNCOVERED'}`) : ['No new surfaces in this diff.'];
                return result(lines.join('\n'), envelope(uncovered.length === 0, uncovered.length ? `${uncovered.length} uncovered surface(s)` : `${surfaces.length} surface(s) covered`, { id: unit.id, surfaces, uncovered: uncovered.map((s) => s.surface) }, gateNext(unit.id, 'reach_audit_recorded')));
            }),
        }),
        criteria_map: action({
            describe: 'Map acceptance criteria to hunks by keyword overlap; records a provisional criteria_validation (matched criteria still need real proof).',
            schema: z.object(diffInput),
            handler: async (input, ctx) => withUnit(ctx, input.id, (unit, worktree) => {
                const reqFile = path.join(unit.dir, 'requirement.md');
                if (!fs.existsSync(reqFile))
                    return fail('analyze criteria_map: no requirement.md; record the requirement and criteria first');
                const criteria = parseRequirement(fs.readFileSync(reqFile, 'utf8')).criteria;
                if (!criteria.length)
                    return fail('analyze criteria_map: no acceptance criteria recorded');
                const diff = diffFor(input.diff, unit, worktree);
                if ('error' in diff)
                    return fail(`analyze criteria_map: ${diff.error}`);
                const map = criteriaMap(criteria, diff);
                const results = [
                    ...map.matched.map((m) => ({ criterion: m.criterion.id, status: 'unproven', proof: `diff touches ${m.files.join(', ')} (keyword map only; add a test or run as proof)` })),
                    ...map.unproven.map((c) => ({ criterion: c.id, status: 'unproven', proof: '' })),
                ];
                record(unit, ctx, 'criteria_validation', { results });
                const lines = [
                    ...map.matched.map((m) => `- ${m.criterion.id} ↔ ${m.files.join(', ')} (${m.terms.join(', ')})`),
                    ...map.unproven.map((c) => `- ${c.id}: no matching hunk`),
                    ...map.orphan_hunks.map((h) => `- orphan hunk: ${h.path} (no criterion mentions it)`),
                ];
                const ok = map.unproven.length === 0 && map.orphan_hunks.length === 0;
                return result(lines.join('\n') || 'Nothing to map.', envelope(ok, `${map.matched.length} mapped, ${map.unproven.length} unproven, ${map.orphan_hunks.length} orphan hunk(s)`, { id: unit.id, matched: map.matched.map((m) => ({ id: m.criterion.id, files: m.files })), unproven: map.unproven, orphan_hunks: map.orphan_hunks.map((h) => h.path) }, gateNext(unit.id, 'criteria_validated')));
            }),
        }),
    },
});
