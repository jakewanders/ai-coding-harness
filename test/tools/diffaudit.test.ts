import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDiff } from '../../src/analysis/diff-parse.js';
import { loadRules, runRules, type Rule } from '../../src/diffaudit/rules.js';
import { dispatch } from '../../src/registry/tools.js';
import { readState, writeState } from '../../src/store/state.js';
import { unitDirFor } from '../../src/store/units.js';
import { diffauditTool } from '../../src/tools/diffaudit.js';
import { evidenceTool } from '../../src/tools/evidence.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeRepo } from '../helpers/git.js';

const RULES_YAML = `schema: 1
diffaudit:
  rules:
    - id: no-console
      pattern: "console\\\\.log\\\\("
      files: "src/**/*.ts"
      severity: major
      message: "Remove console.log before merging"
    - id: no-todo
      pattern: "TODO"
      files: "**/*"
      severity: note
      message: "Open TODO"
`;

const DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
-console.log('old');
+const fresh = 1; // TODO tidy
+console.log('new');
 export {};
diff --git a/docs/notes.md b/docs/notes.md
--- a/docs/notes.md
+++ b/docs/notes.md
@@ -1,1 +1,1 @@
-x
+console.log('not code')
`;

async function unitCtx(configYaml = RULES_YAML, id = 'DA-1') {
  const ctx = makeCtx({ cwd: makeRepo({ 'README.md': 'x', '.harness.yaml': configYaml }) });
  await dispatch(unitTool, { action: 'start', source: 'ticket', ref: id }, ctx);
  return ctx;
}

describe('rules', () => {
  it('loads rules from config and matches added lines in matching files only', async () => {
    const ctx = await unitCtx();
    const rules = loadRules(ctx.config.config);
    expect(rules.map((r) => r.id)).toEqual(['no-console', 'no-todo']);
    const findings = runRules(rules, parseDiff(DIFF));
    expect(findings).toEqual([
      { severity: 'note', text: 'Open TODO (no-todo)', path: 'src/a.ts', line: 1, rule: 'no-todo' },
      { severity: 'major', text: 'Remove console.log before merging (no-console)', path: 'src/a.ts', line: 2, rule: 'no-console' },
    ]);
  });

  it('skips invalid patterns and returns no rules on default config', () => {
    const bad: Rule = { id: 'broken', pattern: '(unclosed', files: '**/*', severity: 'minor', message: 'x' };
    expect(runRules([bad], parseDiff(DIFF))).toEqual([]);
    expect(loadRules({ schema: 1 })).toEqual([]);
  });
});

describe('diffaudit tool', () => {
  it('runs the rules over the given diff and records a diffaudit review column', async () => {
    const ctx = await unitCtx();
    const dir = unitDirFor(ctx, 'DA-1');
    writeState(dir, { ...readState(dir), stage: 'review' });
    const r = await dispatch(diffauditTool, { action: 'run', id: 'DA-1', diff: DIFF }, ctx);
    expect(r.envelope.ok).toBe(false);
    expect((r.envelope.data as { findings: unknown[] }).findings).toHaveLength(2);
    expect(r.text).toContain('no-console');
    const column = readState(dir).evidence.find((e) => e.kind === 'review_column')!;
    expect(column.payload).toMatchObject({ column: 'diffaudit', findings: [{ severity: 'note' }, { severity: 'major', path: 'src/a.ts', line: 2 }] });
    const list = await dispatch(diffauditTool, { action: 'rules', id: 'DA-1' }, ctx);
    expect((list.envelope.data as { rules: Rule[] }).rules.map((x) => x.id)).toEqual(['no-console', 'no-todo']);
  });

  it('records an empty column when no rules hit', async () => {
    const ctx = await unitCtx();
    const r = await dispatch(diffauditTool, { action: 'run', id: 'DA-1', diff: 'diff --git a/x.md b/x.md\n--- a/x.md\n+++ b/x.md\n@@ -1,0 +1,1 @@\n+clean\n' }, ctx);
    expect(r.envelope.ok).toBe(true);
    expect(readState(unitDirFor(ctx, 'DA-1')).evidence.at(-1)!.payload).toEqual({ column: 'diffaudit', findings: [] });
  });
});

describe('evidence synthesize and the challenge gates', () => {
  const BASE = ['criteria_forward', 'criteria_reverse', 'adversarial', 'diffaudit', 'ledger'];

  async function recordColumns(ctx: ReturnType<typeof makeCtx>, id: string, overrides: Record<string, unknown[]> = {}) {
    for (const column of BASE) {
      await dispatch(evidenceTool, { action: 'record', id, kind: 'review_column', payload: { column, findings: overrides[column] ?? [] } }, ctx);
    }
  }

  it('writes reviews/cycle-n.json, stores the verdict, and drives review_verdict_ship', async () => {
    const ctx = await unitCtx();
    const dir = unitDirFor(ctx, 'DA-1');
    writeState(dir, { ...readState(dir), stage: 'review' });
    const missing = await dispatch(evidenceTool, { action: 'synthesize', id: 'DA-1' }, ctx);
    expect(missing.envelope.ok).toBe(false);
    expect(missing.envelope.data).toMatchObject({ verdict: 'not_ready' });
    expect((missing.envelope.data as { missing_columns: string[] }).missing_columns).toEqual(BASE);
    let gate = await dispatch(evidenceTool, { action: 'check', id: 'DA-1', gate: 'review_verdict_ship' }, ctx);
    expect(gate.envelope.data).toMatchObject({ status: 'fail' });

    await recordColumns(ctx, 'DA-1', { adversarial: [{ severity: 'major', text: 'unescaped input' }] });
    const attention = await dispatch(evidenceTool, { action: 'synthesize', id: 'DA-1' }, ctx);
    expect(attention.envelope.data).toMatchObject({ verdict: 'needs_attention', counts: { major: 1 } });
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'reviews', 'cycle-0.json'), 'utf8'))).toMatchObject({ cycle: 0, verdict: 'needs_attention' });
    expect(readState(dir).reviews).toEqual({ 0: 'needs_attention' });

    await dispatch(evidenceTool, { action: 'record', id: 'DA-1', kind: 'review_column', payload: { column: 'adversarial', findings: [] } }, ctx);
    const ship = await dispatch(evidenceTool, { action: 'synthesize', id: 'DA-1' }, ctx);
    expect(ship.envelope.ok).toBe(true);
    expect(ship.envelope.data).toMatchObject({ verdict: 'ship' });
    gate = await dispatch(evidenceTool, { action: 'check', id: 'DA-1', gate: 'review_verdict_ship' }, ctx);
    expect(gate.envelope.data).toMatchObject({ status: 'pass' });
  });
});
