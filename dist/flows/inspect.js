import { registerRenderer } from '../registry/stages.js';
import { REVIEW_COLUMNS } from '../review/columns.js';
export const render = (ctx) => {
    const id = ctx.state?.id ?? null;
    const lines = ['# inspect', '', 'Side-effect-free review of any pull request. This flow is read-only: it never commits, pushes, posts, or advances anything.', ''];
    if (!id) {
        lines.push('No unit named. Start one from the PR reference first; the id becomes `pr-<number>`:', '', '```harness', 'unit start { "source": "pr", "ref": "<pr url or #number>" }', 'unit brief { "id": "pr-<number>", "stage": "inspect" }', '```');
        return lines.join('\n');
    }
    lines.push(`Unit ${id} (source: ${ctx.state?.source.ref ?? 'pr'}).`, '', '## Procedure', '', '1. Fetch the PR diff through the codehost seat (or `vcs diff` if the branch is checked out) and read it against its description.', '2. Run the review columns read-only and record each as a `review_column`; that is the only evidence kind this flow records.', '3. Synthesize the verdict and report it to the user. Do not record impact, reach, pii or any other kind, and do not post to the PR.', '', '## Columns', '', ...REVIEW_COLUMNS.filter((c) => !c.requires).map((c) => `- ${c.id}: ${c.describe}`), '', '## Calls', '', '```harness', `vcs diff { "id": "${id}" }`, `evidence record { "id": "${id}", "kind": "review_column", "payload": { "column": "criteria_forward", "findings": [] } }`, `evidence synthesize { "id": "${id}" }`, `unit report { "id": "${id}", "stage": "inspect", "outcome": "done", "summary": "<verdict and the top findings>" }`, '```');
    return lines.join('\n');
};
registerRenderer('inspect', render);
