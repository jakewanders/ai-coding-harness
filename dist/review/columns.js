import { hasCapability } from '../registry/gates.js';
/** The six lean review columns. */
export const REVIEW_COLUMNS = [
    { id: 'criteria_forward', describe: 'Every acceptance criterion has proof in the diff or tests.' },
    { id: 'criteria_reverse', describe: 'Every hunk traces to a criterion.' },
    { id: 'adversarial', describe: 'Fresh-eyes pass assuming every earlier reader was wrong: unmet criteria, untested branches, silent failures, data exposure.' },
    { id: 'diffaudit', describe: 'Config and kit diff-audit rules.' },
    { id: 'ledger', describe: 'Carry-forward ledger items re-verified against this diff.' },
    { id: 'browser', describe: 'Browser findings against the acceptance criteria.', requires: 'browser_ui' },
];
/** Columns a synthesized verdict needs: every column whose capability requirement is met. */
export function requiredColumns({ config, repo }) {
    return REVIEW_COLUMNS.filter((c) => !c.requires || hasCapability(config, repo, c.requires)).map((c) => c.id);
}
