/** Ghostwritten ticket: title, context, numbered acceptance criteria, out of scope. */
export function renderTicket(t) {
    const lines = [`# ${t.title.trim() || 'Untitled'}`, '', '## Context', '', t.context.trim() || '(why this is worth doing, who asked, what happens today)', '', '## Acceptance criteria', ''];
    lines.push(...(t.criteria.length ? t.criteria.map((c, i) => `- AC-${i + 1}: ${c.trim()}`) : ['- No acceptance criteria yet; each one must be observable and testable in one sentence.']));
    lines.push('', '## Out of scope', '');
    lines.push(...(t.out_of_scope.length ? t.out_of_scope.map((o) => `- ${o.trim()}`) : ['- Nothing excluded yet; name what this ticket deliberately does not cover.']));
    lines.push('');
    return lines.join('\n');
}
