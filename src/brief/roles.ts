import type { HarnessConfig } from '../config/schema.js';
import { ROLE_NAMES, type RoleName } from '../contracts/header.js';

export const UNWIRED_NOTE = 'unwired — skip steps that need it and say so';

/** Tool names wired to each role, or `unwired`. */
export function roleWiring(config: HarnessConfig): Record<RoleName, string[] | 'unwired'> {
  const roles = config.roles ?? {};
  const out = {} as Record<RoleName, string[] | 'unwired'>;
  for (const role of ROLE_NAMES) {
    const names: string[] = [];
    const entry = roles[role] as Record<string, string[] | undefined> | undefined;
    for (const list of Object.values(entry ?? {})) for (const name of list ?? []) if (!names.includes(name)) names.push(name);
    out[role] = names.length ? names : 'unwired';
  }
  return out;
}

/** Markdown block listing every role and what fills it. */
export function buildRoleBlock(config: HarnessConfig): string {
  const wiring = roleWiring(config);
  const lines = ['## Roles', ''];
  for (const role of ROLE_NAMES) {
    const w = wiring[role];
    lines.push(`- ${role}: ${w === 'unwired' ? UNWIRED_NOTE : w.join(', ')}`);
  }
  return lines.join('\n');
}
