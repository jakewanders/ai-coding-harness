import { ROLE_NAMES } from '../contracts/header.js';
export const UNWIRED_NOTE = 'unwired — skip steps that need it and say so';
/** Tool names wired to each role, or `unwired`. */
export function roleWiring(config) {
    const roles = config.roles ?? {};
    const out = {};
    for (const role of ROLE_NAMES) {
        const names = [];
        const entry = roles[role];
        for (const list of Object.values(entry ?? {}))
            for (const name of list ?? [])
                if (!names.includes(name))
                    names.push(name);
        out[role] = names.length ? names : 'unwired';
    }
    return out;
}
/** Markdown block listing every role and what fills it. */
export function buildRoleBlock(config) {
    const wiring = roleWiring(config);
    const lines = ['## Roles', ''];
    for (const role of ROLE_NAMES) {
        const w = wiring[role];
        lines.push(`- ${role}: ${w === 'unwired' ? UNWIRED_NOTE : w.join(', ')}`);
    }
    return lines.join('\n');
}
