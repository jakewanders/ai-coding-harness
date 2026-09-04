import type { Kit } from './manifest.js';
export interface DocProfile {
    tags: string[];
    capabilities: Record<string, unknown>;
}
/** Absolute paths of kit docs whose tags intersect the profile tags or whose capabilities are truthy in the profile. */
export declare function selectDocs(kits: Kit[], profile: DocProfile): string[];
