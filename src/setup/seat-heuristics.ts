import { SEAT_NAMES, type SeatName } from '../contracts/header.js';

/**
 * Name heuristics that map a session's visible tool names onto seats. This is
 * the one place product names appear in shipped code; every such line carries
 * the lint allow marker. Product matches run before generic words; a tool is
 * assigned to at most one seat, the first that matches.
 */
type Heuristic = [seat: SeatName, pattern: RegExp];

const PRODUCTS: Heuristic[] = [
  ['tracker', /\b(jira|linear|asana|trello|youtrack|shortcut|clubhouse|monday)\b/i], // harness-lint: allow
  ['codehost', /\b(github|gitlab|bitbucket|gitea|codeberg|azure ?repos)\b/i], // harness-lint: allow
  ['docs', /\b(confluence|notion|gdocs|google ?docs|sharepoint)\b/i], // harness-lint: allow
  ['design', /\b(figma|zeplin|penpot|sketch ?files?)\b/i], // harness-lint: allow
  ['chat', /\b(slack|discord|teams|mattermost|zulip)\b/i], // harness-lint: allow
  ['reviewbot', /\b(coderabbit|copilot|greptile|codium|qodo|sourcery|ellipsis|graphite|sonarqube|codeclimate)\b/i], // harness-lint: allow
];

const GENERIC: Heuristic[] = [
  ['reviewbot', /\b(review ?bot|bot ?review|review status|review)\b/i],
  ['tracker', /\b(ticket|issue|epic|story|sprint|backlog)\b/i],
  ['codehost', /\b(pull ?request|pull|pr|merge ?request|mr|repo|branch|commit|thread)\b/i],
  ['docs', /\b(wiki|page|doc|docs|document|knowledge)\b/i],
  ['design', /\b(design|frame|mockup|prototype|artboard)\b/i],
  ['chat', /\b(chat|message|channel|dm|notify)\b/i],
];

/** Lowercase with separators as spaces so word boundaries fall between the prefix, the product and the verb. */
function tokens(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.:/]+/g, ' ').toLowerCase();
}

/** Seats → tool names, in input order; tools matching nothing are left out. */
export function mapToolsToSeats(toolNames: string[]): Record<SeatName, string[]> {
  const out = Object.fromEntries(SEAT_NAMES.map((s) => [s, [] as string[]])) as Record<SeatName, string[]>;
  for (const name of toolNames) {
    const t = tokens(name);
    const hit = [...PRODUCTS, ...GENERIC].find(([, re]) => re.test(t));
    if (hit) out[hit[0]].push(name);
  }
  return out;
}

/** Tools that mapped to no seat. */
export function unmappedTools(toolNames: string[], seats: Record<SeatName, string[]> = mapToolsToSeats(toolNames)): string[] {
  const mapped = new Set(Object.values(seats).flat());
  return toolNames.filter((n) => !mapped.has(n));
}
