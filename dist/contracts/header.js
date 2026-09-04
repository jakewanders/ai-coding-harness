import { stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';
/**
 * Brief header contract. `unit brief` opens with this fenced YAML block so a
 * skill can read the unit, mode, stage, seats, gates and config problems
 * before any prose. Published in docs/brief-contract.md.
 */
export const BRIEF_CONTRACT = 'harness-brief/1';
export const SEAT_NAMES = ['tracker', 'codehost', 'docs', 'design', 'chat', 'reviewbot'];
export const SEVERITIES = ['block', 'warn', 'off'];
export const GATE_STATUSES = ['pass', 'fail', 'n/a'];
export const ConfigErrorSchema = z.object({
    file: z.string(),
    path: z.string(),
    line: z.number().int().nullable(),
    message: z.string(),
    valid_keys: z.array(z.string()).optional(),
});
const SeatWiringSchema = z.union([z.array(z.string()), z.literal('unwired')]);
export const HeaderSchema = z.object({
    contract: z.literal(BRIEF_CONTRACT),
    unit: z.string(),
    mode: z.string(),
    stage: z.string(),
    repo: z.string(),
    worktree: z.string().nullable(),
    base_branch: z.string(),
    root: z.string(),
    seats: z.object({
        tracker: SeatWiringSchema,
        codehost: SeatWiringSchema,
        docs: SeatWiringSchema,
        design: SeatWiringSchema,
        chat: SeatWiringSchema,
        reviewbot: SeatWiringSchema,
    }).strict(),
    capabilities: z.record(z.string(), z.unknown()),
    gates: z.array(z.object({
        id: z.string(),
        severity: z.enum(SEVERITIES),
        status: z.enum(GATE_STATUSES),
    })),
    docs: z.array(z.string()),
    config_errors: z.array(ConfigErrorSchema),
});
/** Header keys in contract order; `contract` is always first. */
export const HEADER_KEYS = [
    'contract', 'unit', 'mode', 'stage', 'repo', 'worktree', 'base_branch', 'root',
    'seats', 'capabilities', 'gates', 'docs', 'config_errors',
];
/** Fenced yaml block whose first line is `contract: harness-brief/1`. */
export function renderHeader(h) {
    const ordered = {};
    for (const key of HEADER_KEYS)
        ordered[key] = h[key];
    const body = stringifyYaml(ordered, { lineWidth: 0 }).replace(/\n+$/, '');
    return `\`\`\`yaml\n${body}\n\`\`\``;
}
