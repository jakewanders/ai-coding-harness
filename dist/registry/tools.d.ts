import { z } from 'zod';
import type { LoadedConfig } from '../config/load.js';
import { type Envelope } from '../contracts/envelope.js';
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
export declare function defineTool(def: ToolDef): ToolDef;
/** Typed helper so action handlers infer their input type from the schema. */
export declare function action<S extends z.ZodTypeAny>(def: ActionDef<S>): ActionDef;
/** Build a ToolResult: prose plus the rendered envelope. */
export declare function result(text: string, env: Envelope): ToolResult;
export declare function fail(summary: string, data?: unknown): ToolResult;
/** `<description> Actions: a, b, c.` with the action list computed from the registry. */
export declare function describeTool(t: ToolDef): string;
type JsonSchema = Record<string, unknown> & {
    properties?: Record<string, unknown>;
    required?: string[];
};
/**
 * One JSON schema per tool for the MCP host: `action` is a required enum and
 * every parameter of every action is merged in as optional.
 */
export declare function toolInputSchema(t: ToolDef): JsonSchema;
/** Validate the action name, then its params, then run the handler. Never throws. */
export declare function dispatch(t: ToolDef, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
export {};
