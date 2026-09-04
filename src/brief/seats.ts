import type { HarnessConfig } from '../config/schema.js';
import { SEAT_NAMES, type SeatName } from '../contracts/header.js';

export const UNWIRED_NOTE = 'unwired — skip steps that need it and say so';

/** Tool names wired to each seat, or `unwired`. */
export function seatWiring(config: HarnessConfig): Record<SeatName, string[] | 'unwired'> {
  const seats = config.seats ?? {};
  const out = {} as Record<SeatName, string[] | 'unwired'>;
  for (const seat of SEAT_NAMES) {
    const names: string[] = [];
    const entry = seats[seat] as Record<string, string[] | undefined> | undefined;
    for (const list of Object.values(entry ?? {})) for (const name of list ?? []) if (!names.includes(name)) names.push(name);
    out[seat] = names.length ? names : 'unwired';
  }
  return out;
}

/** Markdown block listing every seat and what fills it. */
export function buildSeatBlock(config: HarnessConfig): string {
  const wiring = seatWiring(config);
  const lines = ['## Seats', ''];
  for (const seat of SEAT_NAMES) {
    const w = wiring[seat];
    lines.push(`- ${seat}: ${w === 'unwired' ? UNWIRED_NOTE : w.join(', ')}`);
  }
  return lines.join('\n');
}
