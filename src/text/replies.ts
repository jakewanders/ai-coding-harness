import type { Thread } from '../store/state.js';

export type ReplyAction = 'fix' | 'reply' | 'defer';

export interface ReplyDecision {
  action: ReplyAction;
  text: string;
}

/** Threads grouped by file path (threads without a path under "(general)"), paths sorted. */
export function groupThreads(threads: Thread[]): Array<[path: string, threads: Thread[]]> {
  const groups = new Map<string, Thread[]>();
  for (const t of threads) {
    const key = t.path ?? '(general)';
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function label(t: Thread): string {
  return `${t.id}${t.path ? ` (${t.path}${t.line !== undefined ? `:${t.line}` : ''})` : ''}`;
}

/** One drafted reply per open thread, grouped by path, plus the list to resolve on the host. */
export function renderReplies(threads: Thread[], decisions: Record<string, ReplyDecision>): string {
  const open = threads.filter((t) => !t.resolved);
  if (!open.length) return '# Replies\n\nNo open threads.\n';
  const lines = ['# Replies', '', 'Drafts only; post them through the codehost seat after the user approves.', ''];
  for (const [file, list] of groupThreads(open)) {
    lines.push(`## ${file}`, '');
    for (const t of list) {
      const d = decisions[t.id];
      lines.push(`### ${label(t)}`, '', `> ${t.body.replace(/\n/g, '\n> ')}`, '', `Decision: ${d?.action ?? 'reply'}`, '', d?.text ?? '<draft your reply here>', '');
    }
  }
  const resolve = open.filter((t) => decisions[t.id]?.action === 'fix').map((t) => t.id);
  lines.push(`Resolve on the host: ${resolve.length ? resolve.join(', ') : 'none yet'} (after the batched commit lands).`, '');
  return lines.join('\n');
}
