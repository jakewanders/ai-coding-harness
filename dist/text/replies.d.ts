import type { Thread } from '../store/state.js';
export type ReplyAction = 'fix' | 'reply' | 'defer';
export interface ReplyDecision {
    action: ReplyAction;
    text: string;
}
/** Threads grouped by file path (threads without a path under "(general)"), paths sorted. */
export declare function groupThreads(threads: Thread[]): Array<[path: string, threads: Thread[]]>;
/** One drafted reply per open thread, grouped by path, plus the list to resolve on the host. */
export declare function renderReplies(threads: Thread[], decisions: Record<string, ReplyDecision>): string;
