import { placeholderRenderer } from '../stages/_placeholder.js';
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
const renderers = new Map();
/** Replace the renderer for a stage or flow; used by the stage modules as they land. */
export function registerRenderer(name, render) {
    renderers.set(name, render);
}
function renderFor(name) {
    return (ctx) => (renderers.get(name) ?? placeholderRenderer(name))(ctx);
}
export const STAGES = [
    ...CORE_ORDER.map((name) => ({
        name,
        render: renderFor(name),
        takesNoId: false,
        standalone: false,
        specBanner: SPEC_BANNER_STAGES.has(name),
    })),
    ...FLOW_NAMES.map((name) => ({
        name,
        render: renderFor(name),
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
/** The core stage after `stage`, or null after close. */
export function nextCoreStage(stage) {
    const i = CORE_ORDER.indexOf(stage);
    return i >= 0 && i + 1 < CORE_ORDER.length ? CORE_ORDER[i + 1] : null;
}
