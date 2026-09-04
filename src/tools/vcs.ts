import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { envelope } from '../contracts/envelope.js';
import { baseRefFor, diffAgainst, fetchOrigin, hasRemote, isProtected, porcelainStatus, refuseLocalRef } from '../git/diff.js';
import { currentBranch, git, gitRoot } from '../git/exec.js';
import { addWorktree, createOrCheckoutBranch, deleteBranch, isMerged, refExists, removeWorktree, worktreePathFor } from '../git/worktree.js';
import { resolveMode, UnknownModeError } from '../modes.js';
import { resolveGates, transitionAllowed } from '../registry/gates.js';
import { action, defineTool, fail, result, type ToolContext, type ToolResult } from '../registry/tools.js';
import { parseRequirement } from '../spec/requirement.js';
import { branchNameFor } from '../store/ids.js';
import { homeRelative } from '../store/paths.js';
import { appendHistory, writeState, type CommitRecord } from '../store/state.js';
import { applyTransition } from '../store/transition.js';
import { loadUnit, type LoadedUnit } from '../store/units.js';

function withUnit(ctx: ToolContext, id: string, fn: (unit: LoadedUnit, root: string) => Promise<ToolResult> | ToolResult): Promise<ToolResult> | ToolResult {
  const unit = loadUnit(ctx, id);
  if (!unit) return fail(`unit "${id}" not found in the current namespace`);
  const root = gitRoot(ctx.cwd);
  if (!root) return fail(`vcs: ${ctx.cwd} is not inside a git checkout`);
  return fn(unit, root);
}

/** Where the unit's files live: its worktree when it has one, else the repo root. */
function workDir(unit: LoadedUnit, root: string): string {
  return unit.state.worktree && fs.existsSync(unit.state.worktree) ? unit.state.worktree : root;
}

function unitBranchName(unit: LoadedUnit, title: string | undefined): string {
  if (unit.state.branch) return unit.state.branch;
  const reqFile = path.join(unit.dir, 'requirement.md');
  const fromReq = fs.existsSync(reqFile) ? parseRequirement(fs.readFileSync(reqFile, 'utf8')).title : '';
  return branchNameFor(unit.id, title ?? fromReq);
}

/** Prefer origin/<base> as the starting point when it exists. */
function startPoint(root: string, base: string): string {
  return hasRemote(root) && refExists(root, `origin/${base}`) ? `origin/${base}` : base;
}

export const vcsTool = defineTool({
  name: 'vcs',
  description: 'Git bookkeeping for a unit: fetch, diff against the remote base, branch, worktree, status, gated commit, cleanup.',
  actions: {
    fetch: action({
      describe: 'git fetch origin --prune; reports whether a remote exists.',
      schema: z.object({ id: z.string().describe('Unit id.') }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, (unit, root) => {
          const f = fetchOrigin(workDir(unit, root));
          return result(f.detail, envelope(f.ok, f.remote ? (f.ok ? 'fetched origin' : 'fetch failed') : 'no remote', { id: unit.id, remote: f.remote, detail: f.detail }));
        }),
    }),

    diff: action({
      describe: 'Fetch, then diff the working tree against origin/<base_branch> (or HEAD); unified or --stat, capped at 200 KB.',
      schema: z.object({
        id: z.string().describe('Unit id.'),
        against: z.enum(['base', 'head']).optional().describe('base (default): origin/<base_branch>; head: uncommitted changes only.'),
        ref: z.string().optional().describe('Explicit ref to diff against; local branch names are refused when a remote exists.'),
        stat: z.boolean().optional().describe('Return --stat instead of the full diff.'),
      }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, (unit, root) => {
          const dir = workDir(unit, root);
          const fetched = fetchOrigin(dir);
          if (!fetched.ok) return fail(`vcs diff: fetch failed: ${fetched.detail}`);
          let ref: string;
          let remote = fetched.remote;
          let note: string | null = null;
          if (input.ref) {
            const refusal = refuseLocalRef(dir, input.ref);
            if (refusal) return fail(`vcs diff: ${refusal}`);
            ref = input.ref;
          } else if (input.against === 'head') {
            ref = 'HEAD';
          } else {
            const base = baseRefFor(dir, unit.state.base_branch);
            if ('error' in base) return fail(`vcs diff: ${base.error}`);
            ref = base.ref;
            remote = base.remote;
            note = base.note;
          }
          const d = diffAgainst(dir, ref, input.stat ?? false);
          if ('error' in d) return fail(`vcs diff: ${d.error}`);
          const head = `diff against ${ref}${note ? ` (${note})` : ''}${d.truncated ? ', truncated' : ''}`;
          const text = `${head}\n\n${d.text.trim() || '(no differences)'}`;
          return result(text, envelope(true, head, { id: unit.id, ref, remote, stat: input.stat ?? false, truncated: d.truncated, bytes: d.bytes, note }));
        }),
    }),

    branch: action({
      describe: 'Create or check out the unit branch (<id>-<slug>) from the base branch.',
      schema: z.object({ id: z.string().describe('Unit id.'), title: z.string().optional().describe('Title used for the branch slug.') }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, (unit, root) => {
          const dir = workDir(unit, root);
          const name = unitBranchName(unit, input.title);
          const r = createOrCheckoutBranch(dir, name, startPoint(dir, unit.state.base_branch));
          if (!r.ok) return fail(`vcs branch: ${r.error}`);
          if (unit.state.branch !== name) {
            writeState(unit.dir, { ...unit.state, branch: name }, ctx.now);
            appendHistory(unit.dir, `branch ${r.created ? 'created' : 'checked out'}: ${name}`, ctx.now);
          }
          return result(`${r.created ? 'Created' : 'Checked out'} branch ${name}.`, envelope(true, `branch ${name}`, { id: unit.id, branch: name, created: r.created }));
        }),
    }),

    worktree: action({
      describe: 'Isolate the unit per repo capability isolation: a sibling worktree ../<repo>-<id>, or a branch in place.',
      schema: z.object({ id: z.string().describe('Unit id.'), title: z.string().optional().describe('Title used for the branch slug.') }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, (unit, root) => {
          const isolation = ctx.config.config.repos?.[unit.state.repo]?.capabilities?.isolation ?? 'worktree';
          const branch = unitBranchName(unit, input.title);
          const base = startPoint(root, unit.state.base_branch);
          if (isolation === 'branch') {
            const r = createOrCheckoutBranch(root, branch, base);
            if (!r.ok) return fail(`vcs worktree: ${r.error}`);
            writeState(unit.dir, { ...unit.state, branch, worktree: null }, ctx.now);
            appendHistory(unit.dir, `branch isolation: ${branch} in place`, ctx.now);
            return result(`Branch ${branch} ${r.created ? 'created' : 'checked out'} in place (isolation: branch).`, envelope(true, `branch ${branch} in place`, { id: unit.id, isolation, worktree: null, branch, created: r.created }));
          }
          const dir = unit.state.worktree ?? worktreePathFor(root, unit.id);
          if (fs.existsSync(dir) && git(['rev-parse', '--is-inside-work-tree'], dir).ok) {
            return result(`Worktree already present at ${homeRelative(dir)}.`, envelope(true, 'worktree present', { id: unit.id, isolation, worktree: dir, branch: unit.state.branch ?? branch, created: false }));
          }
          const r = addWorktree(root, dir, branch, base);
          if (!r.ok) return fail(`vcs worktree: ${r.error}`);
          writeState(unit.dir, { ...unit.state, worktree: dir, branch }, ctx.now);
          appendHistory(unit.dir, `worktree created at ${homeRelative(dir)} on ${branch}`, ctx.now);
          return result(`Worktree created at ${homeRelative(dir)} on branch ${branch}.`, envelope(true, `worktree ${homeRelative(dir)}`, { id: unit.id, isolation, worktree: dir, branch, created: true }));
        }),
    }),

    status: action({
      describe: 'Porcelain status of the unit worktree with ahead/behind counts.',
      schema: z.object({ id: z.string().describe('Unit id.') }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, (unit, root) => {
          const s = porcelainStatus(workDir(unit, root));
          if ('error' in s) return fail(`vcs status: ${s.error}`);
          const text = [`branch ${s.branch ?? '(detached)'}${s.upstream ? ` → ${s.upstream}` : ''}, ahead ${s.ahead}, behind ${s.behind}`, ...(s.entries.length ? s.entries : ['clean'])].join('\n');
          return result(text, envelope(true, s.clean ? 'clean' : `${s.entries.length} change(s)`, { id: unit.id, ...s }));
        }),
    }),

    commit: action({
      describe: 'Commit everything in the worktree once the commit-stage gates pass; records the commit and moves the unit to review.',
      schema: z.object({ id: z.string().describe('Unit id.'), message: z.string().min(1).describe('Commit message.') }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, async (unit, root) => {
          const dir = workDir(unit, root);
          const branch = currentBranch(dir);
          const protectedPatterns = ctx.config.config.protected_branches ?? [];
          if (branch && isProtected(branch, protectedPatterns)) return fail(`vcs commit: refusing to commit on protected branch "${branch}"; create the unit branch first (vcs worktree or vcs branch)`);
          const status = porcelainStatus(dir);
          if ('error' in status) return fail(`vcs commit: ${status.error}`);
          if (status.clean) return fail('vcs commit: nothing to commit');

          let mode;
          try {
            mode = resolveMode(unit.state.mode, ctx.config.config);
          } catch (e) {
            if (!(e instanceof UnknownModeError)) throw e;
            mode = resolveMode('thorough', ctx.config.config);
          }
          const gates = await resolveGates('commit', { state: unit.state, config: ctx.config.config, unitDir: unit.dir, worktree: unit.state.worktree }, mode);
          const verdict = transitionAllowed(gates);
          if (!verdict.ok) {
            const lines = ['Commit refused: commit-stage gates are failing.', ...verdict.blocking.map((g) => `- ${g.id}: ${g.remedy ?? 'no remedy given'}`)];
            return result(lines.join('\n'), envelope(false, 'commit blocked by gates', { id: unit.id, blocking: verdict.blocking, warnings: verdict.warnings }));
          }

          const add = git(['add', '-A'], dir);
          if (!add.ok) return fail(`vcs commit: git add failed: ${add.stderr}`);
          const commit = git(['commit', '-q', '-m', input.message], dir);
          if (!commit.ok) return fail(`vcs commit: git commit failed: ${commit.stderr || commit.stdout}`);
          const sha = git(['rev-parse', 'HEAD'], dir).stdout;
          const at = ctx.now().toISOString();
          const record: CommitRecord = { sha, message: input.message, at, cycle: unit.state.cycle };
          let next = { ...unit.state, commits: [...unit.state.commits, record], branch: branch ?? unit.state.branch };
          let moved = false;
          if (next.stage === 'commit') {
            next = applyTransition(next, 'review', at).state;
            moved = true;
          }
          writeState(unit.dir, next, ctx.now);
          appendHistory(unit.dir, `commit ${sha.slice(0, 7)}: ${input.message}${moved ? ' (-> review)' : ''}`, ctx.now);
          const warn = verdict.warnings.length ? ` Warnings: ${verdict.warnings.map((g) => g.id).join(', ')}.` : '';
          return result(
            `Committed ${sha.slice(0, 7)} on ${branch ?? '(detached)'}: ${input.message}.${moved ? ' Unit moved to review.' : ''}${warn}`,
            envelope(true, `committed ${sha.slice(0, 7)}`, { id: unit.id, sha, branch, stage: next.stage, cycle: next.cycle, warnings: verdict.warnings }, [{ tool: 'unit', action: 'brief', why: `now at ${next.stage}; request the brief for ${unit.id}` }]),
          );
        }),
    }),

    cleanup: action({
      describe: 'Remove the unit worktree, delete its branch if merged into the base, and clear state.worktree.',
      schema: z.object({ id: z.string().describe('Unit id.') }),
      handler: async (input, ctx) =>
        withUnit(ctx, input.id, (unit, root) => {
          const notes: string[] = [];
          let worktreeRemoved = false;
          if (unit.state.worktree) {
            const r = removeWorktree(root, unit.state.worktree);
            if (!r.ok) return fail(`vcs cleanup: ${r.error}`);
            worktreeRemoved = true;
            notes.push(`removed worktree ${homeRelative(unit.state.worktree)}`);
          }
          let branchDeleted = false;
          const branch = unit.state.branch;
          if (branch && refExists(root, `refs/heads/${branch}`)) {
            const into = startPoint(root, unit.state.base_branch);
            if (currentBranch(root) === branch) {
              notes.push(`branch ${branch} is checked out here; not deleted`);
            } else if (isMerged(root, branch, into)) {
              const d = deleteBranch(root, branch, true);
              branchDeleted = d.ok;
              notes.push(d.ok ? `deleted merged branch ${branch}` : `could not delete ${branch}: ${d.error}`);
            } else {
              notes.push(`branch ${branch} is not merged into ${into}; kept`);
            }
          }
          writeState(unit.dir, { ...unit.state, worktree: null, branch: branchDeleted ? null : unit.state.branch }, ctx.now);
          appendHistory(unit.dir, `cleanup: ${notes.join('; ') || 'nothing to do'}`, ctx.now);
          return result(notes.join('\n') || 'Nothing to clean up.', envelope(true, 'cleanup done', { id: unit.id, worktree_removed: worktreeRemoved, branch_deleted: branchDeleted, notes }));
        }),
    }),
  },
});
