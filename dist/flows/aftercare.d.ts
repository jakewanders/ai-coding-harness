import { type BriefRenderer } from '../registry/stages.js';
import type { Thread } from '../store/state.js';
export interface Triage {
    fix_now: Thread[];
    new_ticket: Thread[];
    reply_only: Thread[];
}
/** Sort open follow-up comments into fix now, new ticket, or reply only. */
export declare function triage(threads: Thread[]): Triage;
/** Markdown with the three buckets and a drafted text per comment. */
export declare function renderAftercare(id: string, tri: Triage): string;
export declare const render: BriefRenderer;
