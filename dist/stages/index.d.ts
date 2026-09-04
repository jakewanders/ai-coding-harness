import type { StageName } from '../store/state.js';
import type { BriefRenderer } from '../registry/stages.js';
import type { StageInfo } from './_shared.js';
export interface StageModule {
    info: StageInfo;
    render: BriefRenderer;
}
export declare const CORE_STAGE_MODULES: Record<StageName, StageModule>;
