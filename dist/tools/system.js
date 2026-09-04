import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { envelope } from '../contracts/envelope.js';
import { VERSION } from '../index.js';
import { action, defineTool, result } from '../registry/tools.js';
export const systemTool = defineTool({
    name: 'system',
    description: 'Engine housekeeping: version, health, doctor, configuration, inference and sync.',
    actions: {
        version: action({
            describe: 'Report the engine version.',
            schema: z.object({}),
            handler: async () => result(`harness ${VERSION}`, envelope(true, `version ${VERSION}`, { version: VERSION })),
        }),
        health: action({
            describe: 'Report whether the vault is initialized and which Node runs the server.',
            schema: z.object({}),
            handler: async (_input, ctx) => {
                const vault = fs.existsSync(path.join(ctx.vault, '.git')) ? 'ok' : 'missing';
                const data = { vault, node: process.version };
                const text = vault === 'ok' ? `Vault ok at ${ctx.vault}. Node ${process.version}.` : `Vault missing at ${ctx.vault}; it is created on first unit start. Node ${process.version}.`;
                return result(text, envelope(true, `vault ${vault}`, data));
            },
        }),
    },
});
