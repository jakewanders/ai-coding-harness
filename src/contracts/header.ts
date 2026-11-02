import { stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';

/**
 * Brief header contract. `unit brief` opens with this fenced YAML block so a
 * skill can read the unit, mode, stage, roles, gates and config problems
 * before any prose. Published in docs/brief-contract.md.
 */

export const BRIEF_CONTRACT = 'harness-brief/1';

export const ROLE_NAMES = ['tracker', 'codehost', 'docs', 'design', 'chat', 'reviewbot'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const SEVERITIES = ['block', 'warn', 'off'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const GATE_STATUSES = ['pass', 'fail', 'n/a'] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

export interface ConfigError {
  file: string;
  path: string;
  line: number | null;
  message: string;
  valid_keys?: string[];
}

export const ConfigErrorSchema: z.ZodType<ConfigError> = z.object({
  file: z.string(),
  path: z.string(),
  line: z.number().int().nullable(),
  message: z.string(),
  valid_keys: z.array(z.string()).optional(),
});

export interface HeaderGate {
  id: string;
  severity: Severity;
  status: GateStatus;
}

export interface BriefHeader {
  contract: typeof BRIEF_CONTRACT;
  unit: string;
  mode: string;
  stage: string;
  repo: string;
  worktree: string | null;
  base_branch: string;
  root: string;
  roles: Record<RoleName, string[] | 'unwired'>;
  capabilities: Record<string, unknown>;
  gates: HeaderGate[];
  docs: string[];
  config_errors: ConfigError[];
}

const RoleWiringSchema = z.union([z.array(z.string()), z.literal('unwired')]);

export const HeaderSchema: z.ZodType<BriefHeader> = z.object({
  contract: z.literal(BRIEF_CONTRACT),
  unit: z.string(),
  mode: z.string(),
  stage: z.string(),
  repo: z.string(),
  worktree: z.string().nullable(),
  base_branch: z.string(),
  root: z.string(),
  roles: z.object({
    tracker: RoleWiringSchema,
    codehost: RoleWiringSchema,
    docs: RoleWiringSchema,
    design: RoleWiringSchema,
    chat: RoleWiringSchema,
    reviewbot: RoleWiringSchema,
  }).strict(),
  capabilities: z.record(z.string(), z.unknown()),
  gates: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(SEVERITIES),
      status: z.enum(GATE_STATUSES),
    }),
  ),
  docs: z.array(z.string()),
  config_errors: z.array(ConfigErrorSchema),
});

/** Header keys in contract order; `contract` is always first. */
export const HEADER_KEYS: ReadonlyArray<keyof BriefHeader> = [
  'contract', 'unit', 'mode', 'stage', 'repo', 'worktree', 'base_branch', 'root',
  'roles', 'capabilities', 'gates', 'docs', 'config_errors',
];

/** Fenced yaml block whose first line is `contract: harness-brief/1`. */
export function renderHeader(h: BriefHeader): string {
  const ordered: Record<string, unknown> = {};
  for (const key of HEADER_KEYS) ordered[key] = h[key];
  const body = stringifyYaml(ordered, { lineWidth: 0 }).replace(/\n+$/, '');
  return `\`\`\`yaml\n${body}\n\`\`\``;
}
