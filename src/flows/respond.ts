import fs from 'node:fs';
import path from 'node:path';
import { registerRenderer, type BriefRenderer } from '../registry/stages.js';
import { groupThreads, renderReplies } from '../text/replies.js';

export const render: BriefRenderer = (ctx) => {
  const id = ctx.state?.id ?? '<id>';
  const lines = ['# respond', '', `Address the review feedback on the pull request for ${id}.`, ''];
  const pr = ctx.state?.pr;
  if (!pr) {
    lines.push('No pull request recorded for this unit; record it with `pullreq record` and pull its threads with `pullreq threads` first.');
    return lines.join('\n');
  }
  const open = pr.threads.filter((t) => !t.resolved);
  lines.push(`PR: ${pr.url} (${pr.head} → ${pr.base}); ${pr.threads.length} thread(s), ${open.length} open.`, '');
  if (!open.length) {
    lines.push('No open threads. Refresh them with `pullreq threads` if the host shows new ones.');
    return lines.join('\n');
  }
  lines.push('## Open threads by file', '');
  for (const [file, list] of groupThreads(open)) {
    lines.push(`### ${file}`, '');
    for (const t of list) lines.push(`- ${t.id}${t.line !== undefined ? ` line ${t.line}` : ''} (${t.author}): ${t.body}`);
    lines.push('');
  }
  lines.push('## Round rules', '',
    '- Decide per thread: fix (code change), reply (explanation, no change), or defer (new ticket via `ledger add` or a `## Deferred` entry).',
    '- Make every fix in this round, run the check command, then land exactly one batched commit per round with `vcs commit`.',
    '- Draft one reply per thread; post them through the codehost role only with the user\'s approval.',
    '- Resolve on the host only the threads whose fix landed in the batched commit; leave reply-only threads for the reviewer to close.', '');
  if (ctx.unitDir) {
    const draft = path.join(ctx.unitDir, 'drafts', 'replies.md');
    fs.mkdirSync(path.dirname(draft), { recursive: true });
    fs.writeFileSync(draft, renderReplies(pr.threads, {}));
    lines.push(`Reply drafts scaffolded at drafts/replies.md in the unit directory; fill the decision and text per thread.`, '');
  }
  lines.push(`Threads to resolve on the host after the commit: those you mark fix (currently ${open.map((t) => t.id).join(', ')} are open).`, '');
  lines.push('## Calls', '', '```harness', `pullreq threads { "id": "${id}", "threads": [] }`, `exec run { "id": "${id}", "name": "check" }`, `vcs commit { "id": "${id}", "message": "${id}: address review round <n>" }`, `pullreq get { "id": "${id}" }`, '```');
  return lines.join('\n');
};

registerRenderer('respond', render);
