import type { LoadedConfig } from '../config/load.js';
import type { BriefHeader } from '../contracts/header.js';
import { placeholderRenderer } from '../stages/_placeholder.js';
import type { StageName, UnitState } from '../store/state.js';

export type FlowName = 'pilot'|'convoy'|'screen'|'shape'|'inspect'|'respond'|'aftercare'|'botprs'|'draft'|'setup';

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

export const CORE_ORDER: StageName[] = [
  'scope', 'plan', 'build', 'commit', 'review', 'revise', 'challenge', 'verify', 'publish', 'close',
];

export const FLOW_NAMES: readonly FlowName[] = [
  'pilot', 'convoy', 'screen', 'shape', 'inspect', 'respond', 'aftercare', 'botprs', 'draft', 'setup',
];

/** Core stages whose brief opens with the pinned source/spec block. */
const SPEC_BANNER_STAGES = new Set<StageName>(['scope', 'plan', 'build', 'review', 'revise', 'challenge', 'verify']);

/** Flows that start from a source or nothing rather than an existing unit id. */
const NO_ID_FLOWS = new Set<FlowName>(['convoy', 'botprs', 'draft', 'setup']);

const renderers = new Map<string, BriefRenderer>();

/** Replace the renderer for a stage or flow; used by the stage modules as they land. */
export function registerRenderer(name: StageName | FlowName, render: BriefRenderer): void {
  renderers.set(name, render);
}

function renderFor(name: string): BriefRenderer {
  return (ctx) => (renderers.get(name) ?? placeholderRenderer(name))(ctx);
}

export const STAGES: StageEntry[] = [
  ...CORE_ORDER.map((name): StageEntry => ({
    name,
    render: renderFor(name),
    takesNoId: false,
    standalone: false,
    specBanner: SPEC_BANNER_STAGES.has(name),
  })),
  ...FLOW_NAMES.map((name): StageEntry => ({
    name,
    render: renderFor(name),
    takesNoId: NO_ID_FLOWS.has(name),
    standalone: true,
    specBanner: false,
  })),
];

export function stageEntry(name: string): StageEntry | undefined {
  return STAGES.find((s) => s.name === name);
}

export function isCoreStage(name: string): name is StageName {
  return (CORE_ORDER as string[]).includes(name);
}

/** The core stage after `stage`, or null after close. */
export function nextCoreStage(stage: StageName): StageName | null {
  const i = CORE_ORDER.indexOf(stage);
  return i >= 0 && i + 1 < CORE_ORDER.length ? CORE_ORDER[i + 1]! : null;
}
