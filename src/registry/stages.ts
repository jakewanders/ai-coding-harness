import type { LoadedConfig } from '../config/load.js';
import type { BriefHeader } from '../contracts/header.js';
import { CORE_STAGE_MODULES } from '../stages/index.js';
import { flowStub } from '../stages/_shared.js';
import type { StageName, UnitState } from '../store/state.js';

export type FlowName = 'pilot' | 'convoy' | 'screen' | 'inspect' | 'respond' | 'aftercare' | 'setup';

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

export const CORE_ORDER: StageName[] = ['define', 'build', 'review', 'walkthrough', 'pr', 'wrap_up'];

export const FLOW_NAMES: readonly FlowName[] = ['pilot', 'convoy', 'screen', 'inspect', 'respond', 'aftercare', 'setup'];

/** Core stages whose brief opens with the pinned source/spec block. */
const SPEC_BANNER_STAGES = new Set<StageName>(['define', 'build', 'review', 'walkthrough']);

/** Flows that start from a source or nothing rather than an existing unit id. */
const NO_ID_FLOWS = new Set<FlowName>(['inspect', 'convoy', 'setup']);

const flowRenderers = new Map<FlowName, BriefRenderer>();

/** Install a flow's renderer; flow modules call this as they land. */
export function registerRenderer(name: FlowName, render: BriefRenderer): void {
  flowRenderers.set(name, render);
}

function flowRender(name: FlowName): BriefRenderer {
  return (ctx) => (flowRenderers.get(name) ?? flowStub(name))(ctx);
}

export const STAGES: StageEntry[] = [
  ...CORE_ORDER.map((name): StageEntry => ({
    name,
    render: CORE_STAGE_MODULES[name].render,
    takesNoId: false,
    standalone: false,
    specBanner: SPEC_BANNER_STAGES.has(name),
  })),
  ...FLOW_NAMES.map((name): StageEntry => ({
    name,
    render: flowRender(name),
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

export interface RoutingOptions {
  skip: StageName[];
  browserUi: boolean;
}

/**
 * Default next core stage: the next entry of CORE_ORDER, jumping over skipped
 * stages and over walkthrough when the repo has no browser_ui. Null after wrap_up.
 */
export function nextStageFor(current: StageName, opts: RoutingOptions): StageName | null {
  if (current === 'wrap_up') return null;
  let i = CORE_ORDER.indexOf(current);
  while (i + 1 < CORE_ORDER.length) {
    const candidate = CORE_ORDER[i + 1]!;
    i += 1;
    if (opts.skip.includes(candidate)) continue;
    if (candidate === 'walkthrough' && !opts.browserUi) continue;
    return candidate;
  }
  return null;
}
