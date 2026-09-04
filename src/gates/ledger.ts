import { defineGate, registerGate } from '../registry/gates.js';
import { openEntries, readLedger } from '../store/ledger.js';
import { vaultRoot } from '../store/paths.js';

export const ledgerReverified = registerGate(defineGate({
  id: 'ledger_reverified',
  stage: 'review',
  description: 'Every carry-forward ledger entry for the repo was rechecked against this unit, or the ledger is empty.',
  severity: 'warn',
  check: (ctx) => {
    const vault = ctx.vault ?? vaultRoot(process.env, ctx.config.store?.path);
    const pending = openEntries(readLedger(vault, ctx.state.repo)).filter((e) => e.last_checked_unit !== ctx.state.id);
    if (!pending.length) return { pass: true };
    return { pass: false, remedy: `recheck ledger entries against this diff with ledger recheck { entry, id: ${ctx.state.id} }: ${pending.map((e) => `${e.id} (${e.text})`).join('; ')}` };
  },
}));
