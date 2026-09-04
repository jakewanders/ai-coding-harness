import type { LoadedConfig } from '../config/load.js';
import { BRIEF_CONTRACT, renderHeader, type BriefHeader, type ConfigError } from '../contracts/header.js';
import type { ResolvedGate } from '../registry/gates.js';
import { stageEntry, type BriefContext } from '../registry/stages.js';
import { homeRelative } from '../store/paths.js';
import type { UnitState } from '../store/state.js';
import { readSource } from '../store/units.js';
import { buildSeatBlock, seatWiring } from './seats.js';

export const STOP_BANNER = 'Stop after this stage and report to the user.';
export const NO_UNIT = '(none)';

export interface HeaderInputs {
  state: UnitState | null;
  stage: string;
  config: LoadedConfig;
  namespace: string;
  root: string;
  gates: ResolvedGate[];
  docs?: string[];
  baseBranch?: string;
}

export function buildHeader(h: HeaderInputs): BriefHeader {
  const repo = h.state?.repo ?? h.namespace;
  const capabilities = (h.config.config.repos?.[repo]?.capabilities ?? {}) as Record<string, unknown>;
  return {
    contract: BRIEF_CONTRACT,
    unit: h.state?.id ?? NO_UNIT,
    mode: h.state?.mode ?? 'thorough',
    stage: h.stage,
    repo,
    worktree: h.state?.worktree ? homeRelative(h.state.worktree) : null,
    base_branch: h.state?.base_branch ?? h.baseBranch ?? 'main',
    root: h.root,
    seats: seatWiring(h.config.config),
    capabilities,
    gates: h.gates.map((g) => ({ id: g.id, severity: g.severity, status: g.status })),
    docs: h.docs ?? [],
    config_errors: h.config.errors,
  };
}

function configErrorBlock(errors: ConfigError[]): string[] {
  if (!errors.length) return [];
  const lines = ['## Configuration problems', '', 'These layers were skipped; fix them before relying on their settings.', ''];
  for (const e of errors) {
    const where = e.line === null ? e.file : `${e.file}:${e.line}`;
    const at = e.path ? ` at \`${e.path}\`` : '';
    const valid = e.valid_keys?.length ? ` (valid keys: ${e.valid_keys.join(', ')})` : '';
    lines.push(`- ${where}${at}: ${e.message}${valid}`);
  }
  lines.push('');
  return lines;
}

function sourceBlock(ctx: BriefContext): string[] {
  const lines = ['## Source', ''];
  const pinned = ctx.unitDir ? readSource(ctx.unitDir) : null;
  if (pinned === null) {
    const ref = ctx.state?.source.ref;
    lines.push(ref ? `no pinned source; fetch \`${ref}\` (${ctx.state?.source.kind}) through the tracker seat and pin it with \`spec pin\`.` : 'no pinned source.');
  } else {
    lines.push(pinned.trimEnd());
  }
  lines.push('');
  return lines;
}

/** Full brief: header, seats, config problems, source, stage material, stop banner. */
export function renderBrief(ctx: BriefContext): string {
  const entry = stageEntry(ctx.header.stage);
  if (!entry) throw new Error(`unknown stage "${ctx.header.stage}"`);
  const parts: string[] = [renderHeader(ctx.header), '', buildSeatBlock(ctx.config.config), ''];
  parts.push(...configErrorBlock(ctx.config.errors));
  parts.push(...sourceBlock(ctx));
  parts.push(entry.render(ctx).trimEnd(), '');
  if (!ctx.quiet) parts.push(`**${STOP_BANNER}**`, '');
  return parts.join('\n').trimEnd() + '\n';
}
