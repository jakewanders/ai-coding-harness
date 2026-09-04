import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/index.js';
import { allTools } from '../src/registry/index.js';
import { createServer } from '../src/server.js';
import { makeCtx } from './helpers/ctx.js';

async function connected() {
  const server = createServer(makeCtx());
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

describe('server', () => {
  it('lists exactly the registered tools with an action enum each', async () => {
    const { client, close } = await connected();
    try {
      const { tools } = await client.listTools();
      expect(tools.length).toBe(allTools().length);
      expect(tools.map((t) => t.name).sort()).toEqual(allTools().map((t) => t.name).sort());
      for (const t of tools) {
        const def = allTools().find((d) => d.name === t.name)!;
        const schema = t.inputSchema as { required?: string[]; properties?: Record<string, { enum?: string[] }> };
        expect(schema.required).toEqual(['action']);
        expect(schema.properties?.action?.enum).toEqual(Object.keys(def.actions));
        expect(t.description).toContain('Actions:');
      }
    } finally {
      await close();
    }
  });

  it('dispatches a call and returns the envelope text', async () => {
    const { client, close } = await connected();
    try {
      const r = await client.callTool({ name: 'system', arguments: { action: 'version' } });
      const content = r.content as Array<{ type: string; text: string }>;
      expect(content[0]!.type).toBe('text');
      expect(content[0]!.text).toContain(`"version": "${VERSION}"`);
      const bad = await client.callTool({ name: 'system', arguments: { action: 'nope' } });
      expect((bad.content as Array<{ text: string }>)[0]!.text).toContain('"ok": false');
    } finally {
      await close();
    }
  });
});
