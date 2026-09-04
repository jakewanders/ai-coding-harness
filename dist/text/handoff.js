/** Where things stand, open questions, next action. */
export function renderHandoff(state, requirement, digest, opts) {
    const lines = [`# Handoff: ${state.id}${requirement ? ` — ${requirement.title}` : ''}`, ''];
    lines.push('## Where things stand', '');
    lines.push(`- stage: ${state.stage} (cycle ${state.cycle}, mode ${state.mode})`);
    lines.push(`- branch: ${state.branch ?? 'none'}${state.worktree ? ` in worktree ${state.worktree}` : ''}`);
    const lastCommit = state.commits.at(-1);
    lines.push(`- last commit: ${lastCommit ? `${lastCommit.sha.slice(0, 7)} ${lastCommit.message}` : 'none'}`);
    lines.push(`- pull request: ${state.pr ? state.pr.url : 'not opened'}`);
    lines.push(`- evidence records: ${state.evidence.length}; runs: ${state.runs.length}`);
    if (digest) {
        lines.push('', digest.summary);
        if (digest.decisions.length)
            lines.push('', 'Decisions so far:', ...digest.decisions.map((d) => `- ${d}`));
    }
    const questions = opts.questions ?? [];
    lines.push('', '## Open questions', '', ...(questions.length ? questions.map((q) => `- ${q}`) : ['- none recorded']));
    const answered = Object.entries(state.answers);
    if (answered.length)
        lines.push('', 'Answered:', ...answered.map(([q, a]) => `- ${q}: ${a}`));
    lines.push('', '## Next action', '');
    lines.push(opts.next ? `Advance to ${opts.next}: call \`unit advance\` with id \`${state.id}\`, then \`unit brief\` for ${opts.next}.` : `The unit is at ${state.stage}; call \`unit brief\` with id \`${state.id}\` to continue.`);
    return lines.join('\n') + '\n';
}
