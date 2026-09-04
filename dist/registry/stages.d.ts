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
/** Replace the renderer for a stage or flow; used by the stage modules as they land. */
export declare function registerRenderer(name: StageName | FlowName, render: BriefRenderer): void;
export declare const STAGES: StageEntry[];
export declare function stageEntry(name: string): StageEntry | undefined;
export declare function isCoreStage(name: string): name is StageName;
/** The core stage after `stage`, or null after close. */
export declare function nextCoreStage(stage: StageName): StageName | null;
