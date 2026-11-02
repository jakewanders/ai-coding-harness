import * as build from './build.js';
import * as wrap_up from './wrap_up.js';
import * as pr from './pr.js';
import * as review from './review.js';
import * as define from './define.js';
import * as walkthrough from './walkthrough.js';
import type { StageName } from '../store/state.js';
import type { BriefRenderer } from '../registry/stages.js';
import type { StageInfo } from './_shared.js';

export interface StageModule {
  info: StageInfo;
  render: BriefRenderer;
}

export const CORE_STAGE_MODULES: Record<StageName, StageModule> = { define, build, review, walkthrough, pr, wrap_up };
