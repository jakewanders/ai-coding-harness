import { createHash } from 'node:crypto';
/** Tracker-form id: `^[A-Z][A-Z0-9]+-\d+$`. Used for url templates and branch matching only. */
export const TRACKER_ID = /^[A-Z][A-Z0-9]+-\d+$/;
const TRACKER_TOKEN = /(?<![A-Z0-9])[A-Z][A-Z0-9]+-\d+(?![0-9])/g;
export function isTrackerId(s) {
    return TRACKER_ID.test(s);
}
/** `local-` plus the first 8 hex of sha256 over the source text; stable for equal text. */
export function syntheticId(sourceText) {
    return `local-${createHash('sha256').update(sourceText, 'utf8').digest('hex').slice(0, 8)}`;
}
/**
 * Unit id embedded in a branch name: the first tracker-form token, else a
 * known id that appears as a whole segment of the branch, else null.
 */
export function unitFromBranch(branch, knownIds = []) {
    const token = branch.match(TRACKER_TOKEN)?.[0];
    if (token)
        return token;
    const segments = branch.split(/[\/_]/).flatMap((s) => [s, ...splitAroundKnown(s, knownIds)]);
    for (const id of knownIds) {
        if (branch === id || segments.includes(id))
            return id;
    }
    return null;
}
/** Also match a known id followed by `-suffix`, e.g. `local-1a2b3c4d-thing`. */
function splitAroundKnown(segment, knownIds) {
    return knownIds.filter((id) => segment === id || segment.startsWith(`${id}-`));
}
/** Lowercase ASCII slug: letters, digits and single dashes. */
export function slugify(title) {
    return title
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
export const BRANCH_MAX = 60;
/** `<id>-<slug>` trimmed to 60 chars, never ending in a dash. */
export function branchNameFor(id, title) {
    const slug = slugify(title);
    const full = slug ? `${id}-${slug}` : id;
    return full.slice(0, BRANCH_MAX).replace(/-+$/, '');
}
