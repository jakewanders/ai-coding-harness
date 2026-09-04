import { CORE_STAGE_MODULES } from '../stages/index.js';
import { flowStub } from '../stages/_shared.js';
export const CORE_ORDER = [
    'scope', 'plan', 'build', 'commit', 'review', 'revise', 'challenge', 'verify', 'publish', 'close',
];
export const FLOW_NAMES = [
    'pilot', 'convoy', 'screen', 'shape', 'inspect', 'respond', 'aftercare', 'botprs', 'draft', 'setup',
];
/** Core stages whose brief opens with the pinned source/spec block. */
const SPEC_BANNER_STAGES = new Set(['scope', 'plan', 'build', 'review', 'revise', 'challenge', 'verify']);
/** Flows that start from a source or nothing rather than an existing unit id. */
const NO_ID_FLOWS = new Set(['convoy', 'botprs', 'draft', 'setup']);
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
 * Default next core stage. Revise returns to commit; verify runs only with
 * browser_ui and, when the mode says so, after publish; skipped stages are
 * jumped over. Null after close.
 */
export function nextStageFor(current, opts) {
    const order = opts.verifyAfterPublish
        ? ['scope', 'plan', 'build', 'commit', 'review', 'challenge', 'publish', 'verify', 'close']
        : ['scope', 'plan', 'build', 'commit', 'review', 'challenge', 'verify', 'publish', 'close'];
    if (current === 'revise')
        return 'commit';
    if (current === 'close')
        return null;
    let i = order.indexOf(current);
    while (i + 1 < order.length) {
        const candidate = order[i + 1];
        i += 1;
        if (opts.skip.includes(candidate))
            continue;
        if (candidate === 'verify' && !opts.browserUi)
            continue;
        return candidate;
    }
    return null;
}
