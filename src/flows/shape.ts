import fs from 'node:fs';
import path from 'node:path';
import { registerRenderer, type BriefContext, type BriefRenderer } from '../registry/stages.js';
import { parseRelated, parseRequirement, type Criterion, type RelatedItem, type Requirement } from '../spec/requirement.js';

const VAGUE = /\b(fast|quick(ly)?|user-?friendly|intuitive|robust|scalable|nice|better|improve[sd]?|etc\.?|and so on|as needed|appropriate(ly)?|should work|properly)\b/i;
const AMBIGUOUS = /\b(etc\.?|and so on|as needed|tbd|to be decided|maybe|possibly|somehow|or similar|\?)\b|\?/i;

export interface Readiness {
  criteria: Criterion[];
  untestable: Criterion[];
  ambiguities: string[];
  related: RelatedItem[];
  unresolved_links: string[];
  ready: boolean;
}

function readIf(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** Story readiness: criteria present and testable, links recorded, ambiguities listed. */
export function assessReadiness(unitDir: string | null): Readiness & { requirement: Requirement | null } {
  const reqMd = unitDir ? readIf(path.join(unitDir, 'requirement.md')) : null;
  const requirement = reqMd === null ? null : parseRequirement(reqMd);
  const criteria = requirement?.criteria ?? [];
  const untestable = criteria.filter((c) => VAGUE.test(c.text) || c.text.split(/\s+/).length < 3);
  const ambiguities: string[] = [];
  for (const sentence of (requirement?.body ?? '').split(/(?<=[.!?])\s+/)) if (sentence.trim() && AMBIGUOUS.test(sentence)) ambiguities.push(sentence.trim());
  const relMd = unitDir ? readIf(path.join(unitDir, 'related.md')) : null;
  const related = relMd === null ? [] : parseRelated(relMd);
  const unresolved_links = related.filter((r) => !r.title).map((r) => `${r.kind} ${r.ref}`);
  const ready = criteria.length > 0 && untestable.length === 0 && ambiguities.length === 0;
  return { requirement, criteria, untestable, ambiguities, related, unresolved_links, ready };
}

/** Ghostwritten clarification question for the ticket author. */
export function renderClarification(id: string, r: Readiness): string {
  const lines = [`# Clarification request for ${id}`, '', 'Before we start building, a few things need to be pinned down:', ''];
  if (!r.criteria.length) lines.push('- The ticket has no acceptance criteria. Which observable outcomes must be true for this to be done? One sentence each, testable.');
  for (const c of r.untestable) lines.push(`- ${c.id} ("${c.text}") is not testable as written. What measurable outcome would show it is met?`);
  for (const a of r.ambiguities) lines.push(`- "${a}" leaves the scope open. What exactly is included, and what is deliberately not?`);
  for (const l of r.unresolved_links) lines.push(`- Linked item ${l} has no title or summary recorded; is it still relevant, and what does it require of this change?`);
  if (lines.length === 4) lines.push('- Nothing blocking; confirming the criteria as recorded is enough.');
  lines.push('', 'Draft only; send it through the tracker seat after the user approves.');
  return lines.join('\n') + '\n';
}

export const render: BriefRenderer = (ctx: BriefContext) => {
  const id = ctx.state?.id ?? '<id>';
  const r = assessReadiness(ctx.unitDir);
  const lines = ['# shape', '', `Story-readiness review for ${id}: is this ticket ready to scope and build?`, '', '## Readiness', ''];
  lines.push(r.criteria.length ? `Acceptance criteria (${r.criteria.length}):` : 'No acceptance criteria recorded: the story is not ready.', '');
  for (const c of r.criteria) {
    const flag = r.untestable.includes(c) ? ' — vague / not testable as written' : '';
    lines.push(`- ${c.id}: ${c.text}${flag}`);
  }
  lines.push('', `Ambiguities in the requirement text: ${r.ambiguities.length ? '' : 'none found by the wording scan (still read it yourself).'}`);
  for (const a of r.ambiguities) lines.push(`- ${a}`);
  lines.push('', `Links: ${r.related.length ? r.related.map((x) => `${x.kind} ${x.ref}${x.title ? ` (${x.title})` : ' (unresolved: no title recorded)'}`).join('; ') : 'none recorded; cross-check the parent, siblings and prior PRs.'}`);
  lines.push('', `Verdict: ${r.ready ? 'ready to scope' : 'not ready'}.`);
  if (ctx.unitDir) {
    const draft = path.join(ctx.unitDir, 'drafts', 'clarify.md');
    fs.mkdirSync(path.dirname(draft), { recursive: true });
    fs.writeFileSync(draft, renderClarification(id, r));
    lines.push('', '## Clarification draft', '', 'A ghostwritten clarification question is saved at drafts/clarify.md in the unit directory. Review it, then send it only with the user\'s approval.');
  }
  lines.push('', '## Calls', '', '```harness', `spec get { "id": "${id}" }`, `spec criteria { "id": "${id}", "set": ["<testable AC-1>", "<testable AC-2>"] }`, `spec related { "id": "${id}", "items": [{ "kind": "parent", "ref": "<key>", "title": "<title>" }] }`, `unit report { "id": "${id}", "stage": "shape", "outcome": "done", "summary": "<ready or not, and why>" }`, '```');
  return lines.join('\n');
};

registerRenderer('shape', render);
