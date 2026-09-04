import type { HarnessConfig } from '../config/schema.js';
import { type SeatName } from '../contracts/header.js';
export declare const UNWIRED_NOTE = "unwired \u2014 skip steps that need it and say so";
/** Tool names wired to each seat, or `unwired`. */
export declare function seatWiring(config: HarnessConfig): Record<SeatName, string[] | 'unwired'>;
/** Markdown block listing every seat and what fills it. */
export declare function buildSeatBlock(config: HarnessConfig): string;
