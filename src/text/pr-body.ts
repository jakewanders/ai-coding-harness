import { demotionsOf, type ModeDef } from '../modes.js';
import type { Requirement } from '../spec/requirement.js';
import type { EvidenceRecord, UnitState } from '../store/state.js';

export interface PrBodyOptions {
  /** plan.md text; its `## Deferred` bullets become the Not built list. */
  plan?: string | null;
}

/** Bullets under a `## Deferred` heading in plan.md. */
export function parseDeferred(plan: string | null | undefined): string[] {
  if (!plan) return [];
  const lines = plan.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Deferred\s*$/i.test(l.trim()));
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    const m = /^\s*[-*]\s+(.+)$/.exec(line);
    if (m) out.push(m[1]!.trim());
  }
  return out;
}

function latest(state: UnitState, kind: EvidenceRecord['kind']): EvidenceRecord | undefined {
  return state.evidence.filter((e) => e.kind === kind).at(-1);
}

function latestThisCycle(state: UnitState, kind: EvidenceRecord['kind']): EvidenceRecord | undefined {
  return state.evidence.filter((e) => e.kind === kind && e.cycle === state.cycle).at(-1) ?? latest(state, kind);
}

type Validation = { criterion: string; status: string; proof: string };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function scopeLedger(state: UnitState, requirement: Requirement | null): string[] {
  const results = ((latestThisCycle(state, 'criteria_validation')?.payload as { results?: Validation[] } | undefined)?.results ?? []);
  const byId = new Map(results.map((r) => [r.criterion, r]));
  const lines = ['## Scope ledger', '', '| Criterion | Proof | Status |', '|---|---|---|'];
  const criteria = requirement?.criteria ?? [];
  if (!criteria.length) lines.push('| (no acceptance criteria recorded) | | |');
  for (const c of criteria) {
    const v = byId.get(c.id);
    lines.push(`| ${c.id}: ${c.text} | ${v?.proof || '—'} | ${v ? v.status : 'not validated'} |`);
  }
  for (const r of results.filter((r) => !criteria.some((c) => c.id === r.criterion))) {
    lines.push(`| ${r.criterion} (not in requirement) | ${r.proof || '—'} | ${r.status} |`);
  }
  return lines;
}

function evidenceSection(state: UnitState): string[] {
  const lines = ['## Evidence', ''];
  const critique = latestThisCycle(state, 'self_critique')?.payload as { findings?: unknown[] } | undefined;
  lines.push(critique ? `- self-critique: ${plural(critique.findings?.length ?? 0, 'finding')}` : '- self-critique: not recorded');
  const repro = latest(state, 'defect_repro')?.payload as { red_output?: string; green_output?: string } | undefined;
  if (state.kind === 'bug' || repro) {
    lines.push(repro ? `- defect repro: red ${repro.red_output?.trim() ? 'captured' : 'missing'}, green ${repro.green_output?.trim() ? 'captured' : 'pending'}` : '- defect repro: not recorded');
  }
  const pii = latestThisCycle(state, 'pii')?.payload as { findings?: unknown[] } | undefined;
  lines.push(pii ? `- personal-data audit: ${pii.findings?.length ? plural(pii.findings.length, 'finding') : 'clean'}` : '- personal-data audit: not recorded');
  const impact = latestThisCycle(state, 'impact')?.payload as { changed?: Array<{ consumers?: string[] }> } | undefined;
  if (impact) {
    const consumers = new Set((impact.changed ?? []).flatMap((c) => c.consumers ?? []));
    lines.push(`- impact: ${plural(impact.changed?.length ?? 0, 'changed path')}, ${plural(consumers.size, 'consumer')}`);
  } else lines.push('- impact: not recorded');
  const reach = latestThisCycle(state, 'reach_audit')?.payload as { surfaces?: Array<{ subjects?: Array<{ extended: boolean }> }> } | undefined;
  if (reach) {
    const subjects = (reach.surfaces ?? []).flatMap((s) => s.subjects ?? []);
    lines.push(`- reach: ${plural(reach.surfaces?.length ?? 0, 'surface')}, ${subjects.filter((s) => s.extended).length}/${subjects.length} subject lists extended`);
  } else lines.push('- reach: not recorded');
  return lines;
}

function waiversSection(state: UnitState): string[] {
  const waivers = state.evidence.filter((e) => e.kind === 'waiver').map((e) => e.payload as { gate: string; rationale: string });
  return ['## Waivers', '', ...(waivers.length ? waivers.map((w) => `- ${w.gate}: ${w.rationale}`) : ['none'])];
}

function notBuiltSection(plan: string | null | undefined): string[] {
  const deferred = parseDeferred(plan);
  return ['## Not built', '', ...(deferred.length ? deferred.map((d) => `- ${d}`) : ['nothing deferred'])];
}

function modeSection(mode: ModeDef): { mode: string[]; notProven: string[] } {
  const demotions = demotionsOf(mode);
  const modeLines = ['## Mode', '', `Run mode: ${mode.name}${mode.extends ? ` (extends ${mode.extends})` : ''}.`];
  if (demotions.length) modeLines.push('', 'Gate demotions applied by this mode:', ...demotions.map((d) => `- ${d.gate} → ${d.to}`));
  else modeLines.push('', 'No gate demotions.');
  const reduced = demotions.length > 0 || mode.skip_stages.length > 0;
  const notProven: string[] = [];
  if (reduced) {
    notProven.push('## Not proven', '', 'This run did not prove:');
    if (mode.skip_stages.length) notProven.push(`- stages skipped: ${mode.skip_stages.join(', ')}`);
    for (const d of demotions) notProven.push(`- ${d.gate} was ${d.to === 'off' ? 'not enforced' : 'advisory only'}`);
  }
  return { mode: modeLines, notProven };
}

/** The ghostwritten PR body assembled from the unit record. */
export function renderPrBody(state: UnitState, requirement: Requirement | null, mode: ModeDef, opts: PrBodyOptions = {}): string {
  const parts: string[] = [];
  if (mode.banner) parts.push(`> **${mode.banner}**`, '');
  parts.push(`# ${requirement?.title ?? state.id}`, '');
  const summary = requirement?.body?.trim() ? requirement.body.trim() : `Unit ${state.id}${requirement?.url ? ` (${requirement.url})` : ''}.`;
  parts.push('## Summary', '', summary, '');
  if (requirement?.url) parts.push(`Source: ${requirement.url}`, '');
  parts.push(...scopeLedger(state, requirement), '');
  parts.push(...evidenceSection(state), '');
  parts.push(...waiversSection(state), '');
  parts.push(...notBuiltSection(opts.plan), '');
  const { mode: modeLines, notProven } = modeSection(mode);
  parts.push(...modeLines, '');
  if (notProven.length) parts.push(...notProven, '');
  return parts.join('\n').trimEnd() + '\n';
}
