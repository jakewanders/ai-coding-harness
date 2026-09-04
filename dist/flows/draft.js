import fs from 'node:fs';
import path from 'node:path';
import { registerRenderer } from '../registry/stages.js';
import { readSource } from '../store/units.js';
import { renderTicket } from '../text/ticket.js';
export const render = (ctx) => {
    const tracker = ctx.header.seats.tracker;
    const createTools = tracker === 'unwired' ? [] : tracker.filter((t) => /create|new|file/i.test(t));
    const lines = ['# draft', '', "Turn a plain-language request into a ticket: title, context, numbered acceptance criteria, out of scope. The ticket is filed only after the user's approval of the draft.", ''];
    const source = ctx.unitDir ? readSource(ctx.unitDir) : null;
    lines.push('## Request', '', source ? source.trim() : 'No pinned request text; take the request from the conversation and pin it with `spec pin` if you started a unit.', '');
    lines.push('## Template', '', 'Fill every section. Criteria are numbered AC-1… and must each be testable in one sentence; out of scope names what the ticket deliberately excludes.', '', '```markdown', renderTicket({ title: '<title>', context: '<why, who asked, what happens today>', criteria: ['<observable outcome>'], out_of_scope: ['<deliberately excluded>'] }).trimEnd(), '```', '');
    if (ctx.unitDir) {
        const id = ctx.state?.id ?? 'draft';
        const draft = path.join(ctx.unitDir, 'drafts', 'ticket.md');
        fs.mkdirSync(path.dirname(draft), { recursive: true });
        fs.writeFileSync(draft, renderTicket({ title: `Draft ticket from ${id}`, context: source ?? '', criteria: ['<observable outcome>'], out_of_scope: ['<deliberately excluded>'] }));
        lines.push('A scaffold is saved at drafts/ticket.md in the unit directory; overwrite it with the finished draft.', '');
    }
    else {
        lines.push('Start a unit from the request (`unit start { "source": "text", "text": "<request>" }`) to get a drafts/ticket.md scaffold; otherwise keep the draft in the conversation.', '');
    }
    lines.push('## Filing', '');
    if (createTools.length)
        lines.push(`File the ticket only after the user's approval, through the tracker seat's create tool: ${createTools.join(', ')}.`);
    else if (tracker !== 'unwired')
        lines.push(`The tracker seat is wired (${tracker.join(', ')}) but no create tool is configured (seats.tracker.create); file only after the user's approval, by hand or with a tool they name.`);
    else
        lines.push('The tracker seat is unwired and there is no create tool: hand the draft to the user to file; do not attempt to post it anywhere.');
    lines.push('', '```harness', 'unit start { "source": "text", "text": "<the request as given>" }', 'spec pin { "id": "<id>", "text": "<the request as given>" }', 'unit report { "id": "<id>", "stage": "draft", "outcome": "done", "summary": "<title> drafted; awaiting approval to file" }', '```');
    return lines.join('\n');
};
registerRenderer('draft', render);
