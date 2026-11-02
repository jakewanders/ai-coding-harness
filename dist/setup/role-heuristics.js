import { ROLE_NAMES } from '../contracts/header.js';
const PRODUCTS = [
    ['tracker', /\b(jira|linear|asana|trello|youtrack|shortcut|clubhouse|monday)\b/i], // harness-lint: allow
    ['codehost', /\b(github|gitlab|bitbucket|gitea|codeberg|azure ?repos)\b/i], // harness-lint: allow
    ['docs', /\b(confluence|notion|gdocs|google ?docs|sharepoint)\b/i], // harness-lint: allow
    ['design', /\b(figma|zeplin|penpot|sketch ?files?)\b/i], // harness-lint: allow
    ['chat', /\b(slack|discord|teams|mattermost|zulip)\b/i], // harness-lint: allow
    ['reviewbot', /\b(coderabbit|copilot|greptile|codium|qodo|sourcery|ellipsis|graphite|sonarqube|codeclimate)\b/i], // harness-lint: allow
];
const GENERIC = [
    ['reviewbot', /\b(review ?bot|bot ?review|review status|review)\b/i],
    ['tracker', /\b(ticket|issue|epic|story|sprint|backlog)\b/i],
    ['codehost', /\b(pull ?request|pull|pr|merge ?request|mr|repo|branch|commit|thread)\b/i],
    ['docs', /\b(wiki|page|doc|docs|document|knowledge)\b/i],
    ['design', /\b(design|frame|mockup|prototype|artboard)\b/i],
    ['chat', /\b(chat|message|channel|dm|notify)\b/i],
];
/** Lowercase with separators as spaces so word boundaries fall between the prefix, the product and the verb. */
function tokens(name) {
    return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.:/]+/g, ' ').toLowerCase();
}
/** Roles → tool names, in input order; tools matching nothing are left out. */
export function mapToolsToRoles(toolNames) {
    const out = Object.fromEntries(ROLE_NAMES.map((s) => [s, []]));
    for (const name of toolNames) {
        const t = tokens(name);
        const hit = [...PRODUCTS, ...GENERIC].find(([, re]) => re.test(t));
        if (hit)
            out[hit[0]].push(name);
    }
    return out;
}
/** Tools that mapped to no role. */
export function unmappedTools(toolNames, roles = mapToolsToRoles(toolNames)) {
    const mapped = new Set(Object.values(roles).flat());
    return toolNames.filter((n) => !mapped.has(n));
}
