import { SEAT_NAMES } from '../contracts/header.js';
export const UNWIRED_NOTE = 'unwired — skip steps that need it and say so';
/** Tool names wired to each seat, or `unwired`. */
export function seatWiring(config) {
    const seats = config.seats ?? {};
    const out = {};
    for (const seat of SEAT_NAMES) {
        const names = [];
        if (seat === 'counterweight') {
            const cw = seats.counterweight;
            if (cw?.cli)
                names.push(`cli:${cw.cli}`);
            if (cw?.http)
                names.push(`http:${cw.http}`);
        }
        else {
            const entry = seats[seat];
            for (const list of Object.values(entry ?? {}))
                for (const name of list ?? [])
                    if (!names.includes(name))
                        names.push(name);
        }
        out[seat] = names.length ? names : 'unwired';
    }
    return out;
}
/** Markdown block listing every seat and what fills it. */
export function buildSeatBlock(config) {
    const wiring = seatWiring(config);
    const lines = ['## Seats', ''];
    for (const seat of SEAT_NAMES) {
        const w = wiring[seat];
        lines.push(`- ${seat}: ${w === 'unwired' ? UNWIRED_NOTE : w.join(', ')}`);
    }
    return lines.join('\n');
}
