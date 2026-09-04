import * as build from './build.js';
import * as close from './close.js';
import * as publish from './publish.js';
import * as review from './review.js';
import * as scope from './scope.js';
import * as verify from './verify.js';
import type { StageName } from '../store/state.js';
import type { BriefRenderer } from '../registry/stages.js';
import type { StageInfo } from './_shared.js';

export interface StageModule {
  info: StageInfo;
  render: BriefRenderer;
}

export const CORE_STAGE_MODULES: Record<StageName, StageModule> = { scope, build, review, verify, publish, close };
