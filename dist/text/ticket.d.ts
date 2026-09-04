export interface TicketDraft {
    title: string;
    context: string;
    criteria: string[];
    out_of_scope: string[];
}
/** Ghostwritten ticket: title, context, numbered acceptance criteria, out of scope. */
export declare function renderTicket(t: TicketDraft): string;
