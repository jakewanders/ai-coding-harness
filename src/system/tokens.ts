import fs from 'node:fs';
import path from 'node:path';
import { buildHeader, renderBrief } from '../brief/render.js';
import { resolveMode, UnknownModeError } from '../modes.js';
import { CORE_ORDER, type BriefContext } from '../registry/stages.js';
import type { ToolContext } from '../registry/tools.js';
import { createState, type StageName } from '../store/state.js';
import { namespaceFor } from '../store/units.js';

export interface TokenRow {
  stage: StageName;
  skill_bytes: number;
  mode_bytes: number;
  brief_bytes: number;
  bytes: number;
  tokens: number;
}

export interface TokenReport {
  mode: string;
  rows: TokenRow[];
  shared: { bytes: number; tokens: number; files: string[] };
  total: { bytes: number; tokens: number };
}

const tokens = (bytes: number) => Math.ceil(bytes / 4);

function bytesOf(file: string): number {
  return fs.existsSync(file) ? fs.statSync(file).size : 0;
}

/** Instruction load of a full run: skill, mode and rendered brief per core stage, plus shared prose. */
export function measureTokens(ctx: ToolContext, modeName = 'thorough'): TokenReport {
  let mode;
  try {
    mode = resolveMode(modeName, ctx.config.config);
  } catch (e) {
    if (!(e instanceof UnknownModeError)) throw e;
    mode = resolveMode('thorough', ctx.config.config);
  }
  const ns = namespaceFor(ctx.cwd);
  const state = createState({ id: 'TOKENS-1', repo: ns, tracked: true, source: { kind: 'ticket', ref: 'TOKENS-1', pinned: false }, mode: mode.name, base_branch: 'main' }, ctx.now);
  const rows: TokenRow[] = CORE_ORDER.map((stage) => {
    const skill = bytesOf(path.join(ctx.root, 'skills', stage, 'SKILL.md'));
    const modeFile = mode.name === 'thorough' ? 0 : bytesOf(path.join(ctx.root, 'skills', stage, 'modes', `${mode.name}.md`));
    const header = buildHeader({ state: { ...state, stage }, stage, config: ctx.config, namespace: ns, root: ctx.root, gates: [] });
    const briefCtx: BriefContext = { state: { ...state, stage }, config: ctx.config, header, vault: ctx.vault, root: ctx.root, quiet: true, unitDir: null, cwd: ctx.cwd };
    const brief = Buffer.byteLength(renderBrief(briefCtx), 'utf8');
    const total = skill + modeFile + brief;
    return { stage, skill_bytes: skill, mode_bytes: modeFile, brief_bytes: brief, bytes: total, tokens: tokens(total) };
  });
  const sharedDir = path.join(ctx.root, 'skills', '_shared');
  const files = fs.existsSync(sharedDir) ? fs.readdirSync(sharedDir).filter((f) => f.endsWith('.md')).sort() : [];
  const sharedBytes = files.reduce((n, f) => n + bytesOf(path.join(sharedDir, f)), 0);
  const totalBytes = rows.reduce((n, r) => n + r.bytes, 0) + sharedBytes;
  return { mode: mode.name, rows, shared: { bytes: sharedBytes, tokens: tokens(sharedBytes), files }, total: { bytes: totalBytes, tokens: tokens(totalBytes) } };
}

export function renderTokens(r: TokenReport): string {
  const lines = [`Instruction load for a full ${r.mode} run (tokens ≈ bytes / 4):`, '', '| Stage | Skill | Mode | Brief | Bytes | Tokens |', '|---|---|---|---|---|---|'];
  for (const row of r.rows) lines.push(`| ${row.stage} | ${row.skill_bytes} | ${row.mode_bytes} | ${row.brief_bytes} | ${row.bytes} | ${row.tokens} |`);
  lines.push(`| shared (${r.shared.files.length} files) | | | | ${r.shared.bytes} | ${r.shared.tokens} |`);
  lines.push(`| total | | | | ${r.total.bytes} | ${r.total.tokens} |`);
  return lines.join('\n');
}
