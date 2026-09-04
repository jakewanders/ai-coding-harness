import fs from 'node:fs';
import path from 'node:path';
import { registerRenderer } from '../registry/stages.js';
const DEFECT = /\b(crash(es|ed)?|broken|breaks?|error|exception|regression|fails?|failing|not working|doesn'?t work|500|stack ?trace)\b/i;
const REQUEST = /\b(could you also|can you also|would be nice|nice to have|follow-?up|feature|add(ing)? (a|an|the)|support for|also add|enhancement)\b/i;
/** Sort open follow-up comments into fix now, new ticket, or reply only. */
export function triage(threads) {
    const out = { fix_now: [], new_ticket: [], reply_only: [] };
    for (const t of threads) {
        if (t.resolved)
            continue;
        if (DEFECT.test(t.body))
            out.fix_now.push(t);
        else if (REQUEST.test(t.body))
            out.new_ticket.push(t);
        else
            out.reply_only.push(t);
    }
    return out;
}
function draftFor(bucket, t) {
    switch (bucket) {
        case 'fix_now': return `Thanks for the report. Reproducing now; a fix lands on this PR's follow-up as soon as the failing test is in place.`;
        case 'new_ticket': return `Good idea, and out of scope for this change. Filing it as a separate ticket so it gets sized on its own.`;
        default: return `Answering inline: <one-paragraph answer>.`;
    }
}
/** Markdown with the three buckets and a drafted text per comment. */
export function renderAftercare(id, tri) {
    const lines = [`# Aftercare for ${id}`, '', 'Drafts only; post through the codehost or tracker seat after the user approves.', ''];
    const sections = [
        ['fix_now', 'Fix now', 'Defects introduced by the shipped change: reproduce with a failing test, fix on a follow-up unit.'],
        ['new_ticket', 'New ticket', 'Requests beyond the shipped criteria: draft a ticket with `draft` and link it back.'],
        ['reply_only', 'Reply only', 'Questions and remarks that need an answer, not a change.'],
    ];
    for (const [key, title, note] of sections) {
        lines.push(`## ${title}`, '', note, '');
        const items = tri[key];
        if (!items.length)
            lines.push('- none', '');
        for (const t of items)
            lines.push(`### ${t.id} (${t.author})`, '', `> ${t.body}`, '', draftFor(key, t), '');
    }
    return lines.join('\n');
}
export const render = (ctx) => {
    const id = ctx.state?.id ?? '<id>';
    const lines = ['# aftercare', '', `Triage follow-up comments on the shipped unit ${id} into fix now, new ticket, or reply only.`, ''];
    const pr = ctx.state?.pr;
    if (!pr) {
        lines.push('No pull request recorded; record it and pull its threads first (`pullreq record`, `pullreq threads`).');
        return lines.join('\n');
    }
    const tri = triage(pr.threads);
    const total = tri.fix_now.length + tri.new_ticket.length + tri.reply_only.length;
    lines.push(`PR: ${pr.url}; ${total} open comment(s).`, '');
    const buckets = [['fix_now', 'Fix now'], ['new_ticket', 'New ticket'], ['reply_only', 'Reply only']];
    for (const [key, title] of buckets) {
        lines.push(`## ${title}`, '', ...(tri[key].length ? tri[key].map((t) => `- ${t.id} (${t.author}): ${t.body}`) : ['- none']), '');
    }
    if (ctx.unitDir) {
        const draft = path.join(ctx.unitDir, 'drafts', 'aftercare.md');
        fs.mkdirSync(path.dirname(draft), { recursive: true });
        fs.writeFileSync(draft, renderAftercare(id, tri));
        lines.push('Drafted text per comment is at drafts/aftercare.md in the unit directory; the classification above is a wording heuristic, so re-bucket anything that reads wrong.', '');
    }
    lines.push('## Calls', '', '```harness', `pullreq threads { "id": "${id}", "threads": [] }`, `ledger add { "kind": "ask", "text": "<standing ask from a comment>", "id": "${id}" }`, `unit start { "source": "pr", "ref": "${pr.url}" }`, `unit report { "id": "${id}", "stage": "aftercare", "outcome": "done", "summary": "<buckets and actions>" }`, '```');
    return lines.join('\n');
};
registerRenderer('aftercare', render);
