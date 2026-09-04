import { z } from 'zod';
import { envelope } from '../contracts/envelope.js';
import { action, defineTool, result } from '../registry/tools.js';
import { readIndex, rebuildIndex, searchIndex } from '../store/index.js';
export const recallTool = defineTool({
    name: 'recall',
    description: 'Cross-unit search over digests by keyword, and rebuilding of the digest index.',
    actions: {
        search: action({
            describe: 'Keyword search over all digests (term overlap, tags weigh double); returns the top hits.',
            schema: z.object({
                query: z.string().min(1).describe('Free-text query.'),
                repo: z.string().optional().describe('Restrict to one repo namespace.'),
                limit: z.number().int().positive().max(100).optional().describe('Maximum hits (default 10).'),
            }),
            handler: async (input, ctx) => {
                const hits = searchIndex(readIndex(ctx.vault), input.query, { repo: input.repo, limit: input.limit });
                const text = hits.length
                    ? hits.map((h) => `- ${h.id} (${h.repo}, score ${h.score}, matched ${h.matched.join(' ')}): ${h.summary}`).join('\n')
                    : `No matches for "${input.query}".`;
                return result(text, envelope(true, `${hits.length} hit(s)`, { query: input.query, hits }));
            },
        }),
        reindex: action({
            describe: 'Rebuild index/digests.json from every digest.md in the vault.',
            schema: z.object({}),
            handler: async (_input, ctx) => {
                const index = rebuildIndex(ctx.vault, ctx.now);
                return result(`Indexed ${index.entries.length} digest(s).`, envelope(true, `${index.entries.length} indexed`, { indexed: index.entries.length, ids: index.entries.map((e) => e.id) }));
            },
        }),
    },
});
