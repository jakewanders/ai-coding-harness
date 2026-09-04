import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config/load.js';
import { VERSION } from './index.js';
import { allTools, findTool } from './registry/index.js';
import { describeTool, dispatch, fail, toolInputSchema, type ToolContext } from './registry/tools.js';
import { vaultRoot } from './store/paths.js';

/** Plugin install root: the directory containing dist/, skills/, hooks/. */
export function pluginRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/** Build the tool context for a process: config from cwd + env, vault, root. */
export function makeContext(cwd: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): ToolContext {
  const config = loadConfig({ cwd, env });
  return {
    cwd,
    env,
    config,
    vault: vaultRoot(env, config.config.store?.path),
    root: pluginRoot(),
    now: () => new Date(),
  };
}

/** MCP server exposing every registered tool; the transport is attached by the caller. */
export function createServer(ctx: ToolContext): Server {
  const server = new Server({ name: 'harness', version: VERSION }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools().map((t) => ({ name: t.name, description: describeTool(t), inputSchema: toolInputSchema(t) })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = findTool(req.params.name);
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    const r = tool
      ? await dispatch(tool, args, ctx)
      : fail(`unknown tool "${req.params.name}"; tools: ${allTools().map((t) => t.name).join(', ')}`);
    return { content: [{ type: 'text', text: r.text }], isError: !r.envelope.ok };
  });

  return server;
}

export async function main(): Promise<void> {
  const server = createServer(makeContext());
  await server.connect(new StdioServerTransport());
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (entry === import.meta.url) {
  main().catch((e) => {
    process.stderr.write(`harness server failed: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exit(1);
  });
}
