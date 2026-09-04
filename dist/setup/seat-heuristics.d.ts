import { type SeatName } from '../contracts/header.js';
/** Seats → tool names, in input order; tools matching nothing are left out. */
export declare function mapToolsToSeats(toolNames: string[]): Record<SeatName, string[]>;
/** Tools that mapped to no seat. */
export declare function unmappedTools(toolNames: string[], seats?: Record<SeatName, string[]>): string[];
