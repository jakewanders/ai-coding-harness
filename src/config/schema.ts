import { z } from 'zod';

/**
 * Configuration schema, mirroring spec section 5. Every section is optional so
 * a single layer (user file, repo file, kit fragment) may carry only what it
 * overrides; DEFAULTS fills the rest. Objects are strict so unknown keys are
 * reported with their valid siblings.
 */

export { ROLE_NAMES } from '../contracts/header.js';
export type { RoleName } from '../contracts/header.js';

const str = z.string();
const strList = z.array(z.string());

export const SeverityValue = z.enum(['block', 'warn', 'off']);

export const StoreSchema = z.object({
  path: str.optional(),
  remote: str.nullable().optional(),
}).strict();

export const RolesSchema = z.object({
  tracker: z.object({ fetch: strList.optional(), comment: strList.optional(), transition_hint: strList.optional(), create: strList.optional() }).strict().optional(),
  codehost: z.object({
    open_pr: strList.optional(), read_threads: strList.optional(), comment: strList.optional(),
    resolve_thread: strList.optional(), attach: strList.optional(),
  }).strict().optional(),
  docs: z.object({ search: strList.optional() }).strict().optional(),
  design: z.object({ fetch: strList.optional() }).strict().optional(),
  chat: z.object({ post: strList.optional() }).strict().optional(),
  reviewbot: z.object({ status: strList.optional(), threads: strList.optional() }).strict().optional(),
  counterweight: z.object({ cli: str.nullable().optional(), http: str.nullable().optional() }).strict().optional(),
}).strict();

export const CommandsSchema = z.object({
  check: str.optional(), test: str.optional(), lint: str.optional(), typecheck: str.optional(),
  e2e: str.optional(), boot: str.optional(), install: str.optional(),
}).strict();

export const CapabilitiesSchema = z.object({
  isolation: z.enum(['worktree', 'branch']).optional(),
  browser_ui: z.boolean().optional(),
  contracts: z.boolean().optional(),
  component_library: z.boolean().optional(),
  daemon_warmup: str.optional(),
}).strict();

export const SubprojectSchema = z.object({
  path: str.optional(),
  commands: CommandsSchema.optional(),
}).strict();

export const RepoSchema = z.object({
  base_branch: str.optional(),
  commands: CommandsSchema.optional(),
  constraints: z.object({ package_manager: str.optional(), test_flags: strList.optional() }).strict().optional(),
  subprojects: z.record(str, SubprojectSchema).optional(),
  tags: strList.optional(),
  capabilities: CapabilitiesSchema.optional(),
}).strict();

export const EnvironmentSchema = z.object({
  name: str,
  url: str.optional(),
  role: z.enum(['sut', 'reference', 'production']).optional(),
  env_prefix: str.optional(),
}).strict();

export const TicketSchema = z.object({
  pattern: str,
  repo: str.optional(),
  subproject: str.nullable().optional(),
  url: str.optional(),
  status_hints: z.record(str, str).optional(),
}).strict();

export const GateOverrideSchema = z.object({
  severity: SeverityValue.optional(),
  requires: str.nullable().optional(),
}).strict();

export const CustomGateSchema = z.object({
  id: str,
  stage: str,
  command: str,
  severity: SeverityValue.optional(),
}).strict();

export const ModeSchema = z.object({
  extends: str.nullable().optional(),
  demote: z.record(str, SeverityValue).optional(),
  merge_dispatches: z.boolean().optional(),
  walkthrough_after_pr: z.boolean().optional(),
}).strict();

export const DiffauditRuleSchema = z.object({
  id: str,
  pattern: str,
  files: str,
  severity: z.enum(['blocker', 'major', 'minor', 'note']).optional(),
  message: str,
}).strict();

export const HarnessConfigSchema = z.object({
  schema: z.literal(1).optional(),
  store: StoreSchema.optional(),
  roles: RolesSchema.optional(),
  repos: z.record(str, RepoSchema).optional(),
  environments: z.array(EnvironmentSchema).optional(),
  tickets: z.array(TicketSchema).optional(),
  gates: z.record(str, GateOverrideSchema).optional(),
  custom_gates: z.array(CustomGateSchema).optional(),
  modes: z.record(str, ModeSchema).optional(),
  kits: strList.optional(),
  protected_branches: strList.optional(),
  diffaudit: z.object({ rules: z.array(DiffauditRuleSchema).optional() }).strict().optional(),
}).strict();

export type HarnessConfig = z.infer<typeof HarnessConfigSchema>;
export type RepoConfig = z.infer<typeof RepoSchema>;
export type CommandsConfig = z.infer<typeof CommandsSchema>;
export type CapabilitiesConfig = z.infer<typeof CapabilitiesSchema>;
export type TicketConfig = z.infer<typeof TicketSchema>;
export type ModeConfig = z.infer<typeof ModeSchema>;
export type GateOverride = z.infer<typeof GateOverrideSchema>;
export type CustomGateConfig = z.infer<typeof CustomGateSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentSchema>;
export type DiffauditRuleConfig = z.infer<typeof DiffauditRuleSchema>;

export { DEFAULTS } from './defaults.js';
