import type { HarnessConfig, TicketConfig } from './schema.js';
export type TicketRule = TicketConfig;
export type StatusBoundary = 'scope' | 'build' | 'publish' | 'close';
/** First ticket rule whose pattern matches `id`; invalid patterns are skipped. */
export declare function matchTicket(id: string, config: HarnessConfig): TicketRule | null;
/** The rule's url template with every `{id}` filled, or null. */
export declare function ticketUrl(id: string, config: HarnessConfig): string | null;
/** Tracker status the ticket should carry at a stage boundary, or null. */
export declare function statusHint(id: string, boundary: StatusBoundary, config: HarnessConfig): string | null;
