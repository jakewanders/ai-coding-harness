import type { HarnessConfig } from '../config/schema.js';
import type { ModeDef } from '../modes.js';
import { hasCapability } from '../registry/gates.js';

export interface ReviewColumnDef {
  id: string;
  describe: string;
  /** Repo capability the column needs. */
  requires?: string;
}

/** The six lean review columns. */
export const REVIEW_COLUMNS: ReviewColumnDef[] = [
  { id: 'criteria_forward', describe: 'Every acceptance criterion has proof in the diff or tests.' },
  { id: 'criteria_reverse', describe: 'Every hunk traces to a criterion.' },
  { id: 'adversarial', describe: 'Fresh-eyes pass assuming every earlier reader was wrong: unmet criteria, untested branches, silent failures, data exposure.' },
  { id: 'diffaudit', describe: 'Config and kit diff-audit rules.' },
  { id: 'ledger', describe: 'Carry-forward ledger items re-verified against this diff.' },
  { id: 'browser', describe: 'Browser findings against the acceptance criteria.', requires: 'browser_ui' },
];

export interface RequiredColumnsInput {
  config: HarnessConfig;
  repo: string;
  mode?: ModeDef;
}

/** Columns a synthesized verdict needs: every column whose capability requirement is met. */
export function requiredColumns({ config, repo }: RequiredColumnsInput): string[] {
  return REVIEW_COLUMNS.filter((c) => !c.requires || hasCapability(config, repo, c.requires)).map((c) => c.id);
}
