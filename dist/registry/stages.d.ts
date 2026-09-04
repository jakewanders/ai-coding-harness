import type { LoadedConfig } from '../config/load.js';
import type { BriefHeader } from '../contracts/header.js';
import type { StageName, UnitState } from '../store/state.js';
export type FlowName = 'pilot' | 'convoy' | 'screen' | 'shape' | 'inspect' | 'respond' | 'aftercare' | 'botprs' | 'draft' | 'setup';
export interface BriefContext {
    state: UnitState | null;
    config: LoadedConfig;
    header: BriefHeader;
    vault: string;
    root: string;
    quiet: boolean;
    unitDir: string | null;
    /** Checkout the brief was requested from; used to infer commands when the unit has no worktree. */
    cwd?: string;
}
export type BriefRenderer = (ctx: BriefContext) => string;
export interface StageEntry {
    name: StageName | FlowName;
    render: BriefRenderer;
    takesNoId: boolean;
    standalone: boolean;
    specBanner: boolean;
}
export declare const CORE_ORDER: StageName[];
export declare const FLOW_NAMES: readonly FlowName[];
/** Install a flow's renderer; flow modules call this as they land. */
export declare function registerRenderer(name: FlowName, render: BriefRenderer): void;
export declare const STAGES: StageEntry[];
export declare function stageEntry(name: string): StageEntry | undefined;
export declare function isCoreStage(name: string): name is StageName;
export interface RoutingOptions {
    skip: StageName[];
    browserUi: boolean;
    verifyAfterPublish: boolean;
}
/**
 * Default next core stage. Revise returns to commit; verify runs only with
 * browser_ui and, when the mode says so, after publish; skipped stages are
 * jumped over. Null after close.
 */
export declare function nextStageFor(current: StageName, opts: RoutingOptions): StageName | null;
