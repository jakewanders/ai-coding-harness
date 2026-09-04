import path from 'node:path';
import type { Hunkfile } from './diff-parse.js';
import { listFiles, matchGlobs, readText } from './files.js';
import { changedExports } from './impact.js';

export interface ReachSubjects {
  e2e_globs: string[];
  mock_globs: string[];
  contract_globs: string[];
}

export type SubjectKind = 'e2e' | 'mock' | 'contract';

export interface Surface {
  surface: string;
  kind: 'file' | 'export' | 'route';
  covered_by: string[];
  /** Kind of each covering subject, parallel to covered_by. */
  covered_kinds: SubjectKind[];
}

export const DEFAULT_SUBJECTS: ReachSubjects = {
  e2e_globs: ['**/e2e/**', '**/*.e2e.*', '**/*.spec.*', '**/tests/e2e/**'],
  mock_globs: ['**/mocks/**', '**/__mocks__/**', '**/*.mock.*', '**/handlers/**', '**/fixtures/**'],
  contract_globs: ['**/contracts/**', '**/*.contract.*', '**/openapi*', '**/*.schema.*', '**/schema/**'],
};

const ROUTE_PATTERNS: RegExp[] = [
  /\b(?:app|router|server|api|\w+Router)\.(?:get|post|put|delete|patch|options|head|all)\(\s*['"`]([^'"`]+)['"`]/,
  /@(?:Route|Get|Post|Put|Delete|Patch|Controller)\(\s*['"`]([^'"`]+)['"`]/,
  /\bpath:\s*['"`]([^'"`]+)['"`]/,
  /\b(?:Route|route)\(\s*['"`]([^'"`]+)['"`]/,
];

/** New files, exports and routes introduced by the diff. */
export function surfacesOf(diff: Hunkfile[]): Array<{ surface: string; kind: Surface['kind'] }> {
  const out: Array<{ surface: string; kind: Surface['kind'] }> = [];
  const push = (surface: string, kind: Surface['kind']) => { if (!out.some((s) => s.surface === surface)) out.push({ surface, kind }); };
  for (const file of diff) {
    if (file.isNew) push(file.path, 'file');
    for (const e of changedExports(file.path, file.added)) push(e.name, 'export');
    for (const { text } of file.added) {
      for (const re of ROUTE_PATTERNS) {
        const m = re.exec(text);
        if (m && m[1]!.startsWith('/')) push(m[1]!, 'route');
      }
    }
  }
  return out;
}

function mentions(text: string, surface: Surface['kind'], name: string): boolean {
  if (surface === 'file') {
    const stem = path.basename(name).replace(/\.[^.]+$/, '');
    return text.includes(name) || new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
  }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}(?![\\w/-])`).test(text);
}

/** For each new surface, the subject files (e2e, mock, contract) that mention it. */
export function reachAudit(diff: Hunkfile[], subjects: ReachSubjects, worktree: string): Surface[] {
  const files = listFiles(worktree);
  const groups: Array<[SubjectKind, string[]]> = [
    ['e2e', matchGlobs(files, subjects.e2e_globs)],
    ['mock', matchGlobs(files, subjects.mock_globs)],
    ['contract', matchGlobs(files, subjects.contract_globs)],
  ];
  const texts = new Map<string, string>();
  const textOf = (rel: string) => {
    if (!texts.has(rel)) texts.set(rel, readText(worktree, rel) ?? '');
    return texts.get(rel)!;
  };
  return surfacesOf(diff).map(({ surface, kind }) => {
    const covered_by: string[] = [];
    const covered_kinds: SubjectKind[] = [];
    for (const [subjectKind, list] of groups) {
      for (const rel of list) {
        if (covered_by.includes(rel) || rel === surface) continue;
        if (mentions(textOf(rel), kind, surface)) { covered_by.push(rel); covered_kinds.push(subjectKind); }
      }
    }
    return { surface, kind, covered_by, covered_kinds };
  });
}
