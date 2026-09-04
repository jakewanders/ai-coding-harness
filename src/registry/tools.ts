import { z } from 'zod';
import type { LoadedConfig } from '../config/load.js';
import { envelope, renderResponse, type Envelope } from '../contracts/envelope.js';

export interface ToolContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
  config: LoadedConfig;
  vault: string;
  root: string;
  now: () => Date;
}

export interface ToolResult {
  text: string;
  envelope: Envelope;
}

export interface ActionDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  describe: string;
  schema: S;
  handler: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolDef {
  name: string;
  description: string;
  actions: Record<string, ActionDef>;
}

/** Identity with a type check; keeps tool files declarative. */
export function defineTool(def: ToolDef): ToolDef {
  return def;
}

/** Typed helper so action handlers infer their input type from the schema. */
export function action<S extends z.ZodTypeAny>(def: ActionDef<S>): ActionDef {
  return def as unknown as ActionDef;
}

/** Build a ToolResult: prose plus the rendered envelope. */
export function result(text: string, env: Envelope): ToolResult {
  return { text: renderResponse(text, env), envelope: env };
}

export function fail(summary: string, data: unknown = null): ToolResult {
  return result(summary, envelope(false, summary, data));
}

/** `<description> Actions: a, b, c.` with the action list computed from the registry. */
export function describeTool(t: ToolDef): string {
  return `${t.description.trim()} Actions: ${Object.keys(t.actions).join(', ')}.`;
}

type JsonSchema = Record<string, unknown> & { properties?: Record<string, unknown>; required?: string[] };

/**
 * One JSON schema per tool for the MCP host: `action` is a required enum and
 * every parameter of every action is merged in as optional.
 */
export function toolInputSchema(t: ToolDef): JsonSchema {
  const properties: Record<string, unknown> = {
    action: { type: 'string', enum: Object.keys(t.actions), description: 'Which action to perform.' },
  };
  for (const [name, def] of Object.entries(t.actions)) {
    const json = z.toJSONSchema(def.schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
    for (const [prop, schema] of Object.entries(json.properties ?? {})) {
      if (prop === 'action') continue;
      const existing = properties[prop] as { description?: string } | undefined;
      const described = { ...(schema as Record<string, unknown>) };
      const desc = (described.description as string | undefined) ?? '';
      const tagged = `[${name}] ${desc}`.trim();
      described.description = existing?.description ? `${existing.description}; ${tagged}` : tagged;
      properties[prop] = described;
    }
  }
  return { type: 'object', properties, required: ['action'], additionalProperties: true };
}

function issuePaths(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`).join('; ');
}

/** Validate the action name, then its params, then run the handler. Never throws. */
export async function dispatch(t: ToolDef, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const valid = Object.keys(t.actions);
  const name = typeof input.action === 'string' ? input.action : '';
  const def = t.actions[name];
  if (!def) {
    const shown = name ? `unknown action "${name}"` : 'missing action';
    return fail(`${t.name}: ${shown}; valid actions: ${valid.join(', ')}`, { valid_actions: valid });
  }
  const { action: _drop, ...params } = input;
  const parsed = def.schema.safeParse(params);
  if (!parsed.success) {
    return fail(`${t.name} ${name}: invalid params: ${issuePaths(parsed.error)}`, { issues: parsed.error.issues });
  }
  try {
    return await def.handler(parsed.data, ctx);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return fail(`${t.name} ${name} failed: ${message}`);
  }
}
