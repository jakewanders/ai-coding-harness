import type { Kit } from './manifest.js';

export interface DocProfile {
  tags: string[];
  capabilities: Record<string, unknown>;
}

/** Absolute paths of kit docs whose tags intersect the profile tags or whose capabilities are truthy in the profile. */
export function selectDocs(kits: Kit[], profile: DocProfile): string[] {
  const tags = new Set(profile.tags);
  const out: string[] = [];
  for (const kit of kits) {
    for (const doc of kit.docs) {
      const byTag = doc.tags.some((t) => tags.has(t));
      const byCap = doc.capabilities.some((c) => Boolean(profile.capabilities[c]));
      if ((byTag || byCap) && !out.includes(doc.path)) out.push(doc.path);
    }
  }
  return out;
}
