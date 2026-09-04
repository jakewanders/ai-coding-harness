import { CORE_STAGE_MODULES } from '../stages/index.js';
import { flowStub } from '../stages/_shared.js';
export const CORE_ORDER = ['scope', 'build', 'review', 'verify', 'publish', 'close'];
export const FLOW_NAMES = ['pilot', 'convoy', 'screen', 'inspect', 'respond', 'aftercare', 'setup'];
/** Core stages whose brief opens with the pinned source/spec block. */
const SPEC_BANNER_STAGES = new Set(['scope', 'build', 'review', 'verify']);
/** Flows that start from a source or nothing rather than an existing unit id. */
const NO_ID_FLOWS = new Set(['inspect', 'convoy', 'setup']);
const flowRenderers = new Map();
/** Install a flow's renderer; flow modules call this as they land. */
export function registerRenderer(name, render) {
    flowRenderers.set(name, render);
}
function flowRender(name) {
    return (ctx) => (flowRenderers.get(name) ?? flowStub(name))(ctx);
}
export const STAGES = [
    ...CORE_ORDER.map((name) => ({
        name,
        render: CORE_STAGE_MODULES[name].render,
        takesNoId: false,
        standalone: false,
        specBanner: SPEC_BANNER_STAGES.has(name),
    })),
    ...FLOW_NAMES.map((name) => ({
        name,
        render: flowRender(name),
        takesNoId: NO_ID_FLOWS.has(name),
        standalone: true,
        specBanner: false,
    })),
];
export function stageEntry(name) {
    return STAGES.find((s) => s.name === name);
}
export function isCoreStage(name) {
    return CORE_ORDER.includes(name);
}
/**
 * Default next core stage: the next entry of CORE_ORDER, jumping over skipped
 * stages and over verify when the repo has no browser_ui. Null after close.
 */
export function nextStageFor(current, opts) {
    if (current === 'close')
        return null;
    let i = CORE_ORDER.indexOf(current);
    while (i + 1 < CORE_ORDER.length) {
        const candidate = CORE_ORDER[i + 1];
        i += 1;
        if (opts.skip.includes(candidate))
            continue;
        if (candidate === 'verify' && !opts.browserUi)
            continue;
        return candidate;
    }
    return null;
}
