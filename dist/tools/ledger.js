import { z } from 'zod';
import { envelope } from '../contracts/envelope.js';
import '../gates/index.js';
import { action, defineTool, fail, result } from '../registry/tools.js';
import { nextLedgerId, readLedger, writeLedger } from '../store/ledger.js';
import { namespaceFor } from '../store/units.js';
function repoOf(ctx, repo) {
    return repo ?? namespaceFor(ctx.cwd);
}
function line(e) {
    return `- ${e.id} [${e.kind}, ${e.status}] ${e.text}${e.origin_unit ? ` (from ${e.origin_unit})` : ''}${e.last_checked_unit ? ` — last checked by ${e.last_checked_unit}` : ''}`;
}
/** Locate an entry across the current repo ledger (entries are keyed per repo). */
function findEntry(ctx, entryId) {
    const repo = repoOf(ctx);
    const entry = readLedger(ctx.vault, repo).entries.find((e) => e.id === entryId);
    return entry ? { repo, entry } : null;
}
function save(ctx, repo, entry) {
    const ledger = readLedger(ctx.vault, repo);
    ledger.entries = ledger.entries.map((e) => (e.id === entry.id ? entry : e));
    writeLedger(ctx.vault, repo, ledger);
}
export const ledgerTool = defineTool({
    name: 'ledger',
    description: 'Per-repo carry-forward ledger: standing asks and past landings that every later unit re-verifies.',
    actions: {
        add: action({
            describe: 'Add a carry-forward entry (ask = standing request, landing = past change to protect).',
            schema: z.object({
                repo: z.string().optional().describe('Repo namespace; defaults to the current checkout.'),
                kind: z.enum(['ask', 'landing']),
                text: z.string().min(1),
                id: z.string().optional().describe('Unit the entry originates from.'),
            }),
            handler: async (input, ctx) => {
                const repo = repoOf(ctx, input.repo);
                const ledger = readLedger(ctx.vault, repo);
                const entry = { id: nextLedgerId(ledger), repo, kind: input.kind, text: input.text, origin_unit: input.id ?? null, created_at: ctx.now().toISOString(), status: 'open' };
                ledger.entries.push(entry);
                writeLedger(ctx.vault, repo, ledger);
                return result(`Added ${entry.id} to the ${repo} ledger.`, envelope(true, `${entry.id} added`, { repo, entry }));
            },
        }),
        list: action({
            describe: 'List ledger entries for a repo, optionally filtered by status.',
            schema: z.object({ repo: z.string().optional(), status: z.enum(['open', 'rechecked', 'closed']).optional() }),
            handler: async (input, ctx) => {
                const repo = repoOf(ctx, input.repo);
                const entries = readLedger(ctx.vault, repo).entries.filter((e) => (input.status ? e.status === input.status : true));
                return result(entries.length ? entries.map(line).join('\n') : `No ledger entries for ${repo}.`, envelope(true, `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`, { repo, entries }));
            },
        }),
        recheck: action({
            describe: 'Mark an entry rechecked against a unit, with an optional note.',
            schema: z.object({ entry: z.string().describe('Ledger entry id (L-n).'), id: z.string().describe('Unit that rechecked it.'), note: z.string().optional() }),
            handler: async (input, ctx) => {
                const found = findEntry(ctx, input.entry);
                if (!found)
                    return fail(`ledger recheck: no entry ${input.entry} in ${repoOf(ctx)}`);
                if (found.entry.status === 'closed')
                    return fail(`ledger recheck: ${input.entry} is closed`);
                const notes = [...(found.entry.notes ?? []), ...(input.note ? [`${input.id}: ${input.note}`] : [])];
                const entry = { ...found.entry, status: 'rechecked', last_checked_unit: input.id, notes };
                save(ctx, found.repo, entry);
                return result(`${entry.id} rechecked by ${input.id}.`, envelope(true, `${entry.id} rechecked`, { repo: found.repo, entry }));
            },
        }),
        close: action({
            describe: 'Close an entry with a reason; closed entries no longer need rechecking.',
            schema: z.object({ entry: z.string().describe('Ledger entry id (L-n).'), reason: z.string().min(1) }),
            handler: async (input, ctx) => {
                const found = findEntry(ctx, input.entry);
                if (!found)
                    return fail(`ledger close: no entry ${input.entry} in ${repoOf(ctx)}`);
                const entry = { ...found.entry, status: 'closed', closed_reason: input.reason };
                save(ctx, found.repo, entry);
                return result(`${entry.id} closed: ${input.reason}.`, envelope(true, `${entry.id} closed`, { repo: found.repo, entry }));
            },
        }),
    },
});
