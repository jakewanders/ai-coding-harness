import { statusHint } from '../config/tickets.js';
import { registerRenderer } from '../registry/stages.js';
import { SCREEN_SLOTS } from '../review/consensus.js';
export const render = (ctx) => {
    const id = ctx.state?.id ?? '<id>';
    const hint = ctx.state ? statusHint(ctx.state.id, 'scope', ctx.config.config) : null;
    const lines = [
        '# screen',
        '',
        `Ticket validity triage for ${id}: decide whether this ticket is valid to work on before anyone scopes it.`,
        '',
        '## Four structured calls',
        '',
        'Make one call per dimension per model and record each one. There is no second-opinion seat: the `second` call is',
        'a second framing by the same model, made after the primary call and arguing the opposite case first; say so in its reasons.',
        'Each call answers: is the ticket valid (buildable and worth building as written), invalid, or unclear? Give reasons.',
        '',
        '- technical: can this be built as described in this repo, and is the described change coherent?',
        '- product: is the outcome wanted, for whom, and does the ticket say enough to know when it is done?',
        '',
        '```harness',
        ...SCREEN_SLOTS.map(([dimension, model]) => `evidence record { "id": "${id}", "kind": "screen_verdict", "payload": { "dimension": "${dimension}", "model": "${model}", "verdict": "valid", "reasons": ["<reason>"] } }`),
        `evidence list { "id": "${id}", "kind": "screen_verdict" }`,
        '```',
        '',
        '## Consensus',
        '',
        'Compute the consensus over the four records: unanimous → that verdict; any invalid next to a valid, or any unclear → unclear.',
        'Report the verdict, the agreement share, and every dissenting or missing slot with its reasons.',
        '',
        '## Tracker status',
        '',
        hint ? `Suggested status hint for a valid ticket: "${hint}" (from the ticket rule for scope). Apply it only through the tracker seat and only with the user's approval.` : 'No status hint is configured for this ticket at the scope boundary; report the verdict without proposing a status change.',
        '',
        `Finish with \`unit report\` for stage screen carrying the consensus verdict in the summary; do not advance the unit.`,
    ];
    return lines.join('\n');
};
registerRenderer('screen', render);
