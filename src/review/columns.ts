import type { HarnessConfig } from '../config/schema.js';
import type { ModeDef } from '../modes.js';
import { hasCapability } from '../registry/gates.js';
import { seatWiring } from '../brief/seats.js';

export interface ReviewColumnDef {
  id: string;
  describe: string;
  /** Capability (or the `counterweight` seat) the column needs. */
  requires?: string;
}

/** The thirteen review columns from spec section 8. */
export const REVIEW_COLUMNS: ReviewColumnDef[] = [
  { id: 'criteria_forward', describe: 'Every acceptance criterion has proof in the diff or tests.' },
  { id: 'criteria_reverse', describe: 'Every hunk traces to a criterion.' },
  { id: 'architecture', describe: 'Structure, boundaries and dependencies.' },
  { id: 'security', describe: 'Input handling, auth, secrets, data exposure.' },
  { id: 'tests', describe: 'Coverage and quality of the tests that changed or should have.' },
  { id: 'performance', describe: 'Hot paths, allocations, queries, payload sizes.' },
  { id: 'component_library', describe: 'Conformance to the shared component library.', requires: 'component_library' },
  { id: 'accessibility', describe: 'Keyboard, labels, contrast, focus order.', requires: 'browser_ui' },
  { id: 'diffaudit', describe: 'Config and kit diff-audit rules.' },
  { id: 'ledger', describe: 'Carry-forward ledger items re-verified against this diff.' },
  { id: 'adversarial', describe: 'In-cycle adversarial pass.' },
  { id: 'counterweight', describe: 'Second-opinion model findings.', requires: 'counterweight' },
  { id: 'browser', describe: 'Browser findings against the acceptance criteria.', requires: 'browser_ui' },
];

export interface RequiredColumnsInput {
  config: HarnessConfig;
  repo: string;
  mode: ModeDef;
}

/**
 * Columns a synthesized verdict needs: every column whose requirement is met.
 * The counterweight column is required only when its seat is wired and the
 * mode keeps counterweight_consulted at block.
 */
export function requiredColumns({ config, repo, mode }: RequiredColumnsInput): string[] {
  const wiring = seatWiring(config);
  return REVIEW_COLUMNS.filter((c) => {
    if (!c.requires) return true;
    if (c.requires === 'counterweight') {
      const demoted = mode.demote.counterweight_consulted;
      return wiring.counterweight !== 'unwired' && demoted !== 'warn' && demoted !== 'off';
    }
    return hasCapability(config, repo, c.requires);
  }).map((c) => c.id);
}
