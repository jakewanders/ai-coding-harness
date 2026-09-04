import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface DistCheck {
  fresh: boolean;
  differences: string[];
}

function listFiles(dir: string, prefix = ''): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

/** Build src/ into a temp directory and diff it against the committed dist/. */
export function checkDist(root: string): DistCheck {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-dist-'));
  try {
    const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
    if (!fs.existsSync(tsc)) return { fresh: false, differences: [`typescript not installed at ${tsc}; run npm install`] };
    const r = spawnSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.json'), '--outDir', tmp], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) return { fresh: false, differences: [`build failed: ${(r.stdout + r.stderr).trim().split('\n').slice(0, 5).join(' | ')}`] };
    const committed = path.join(root, 'dist');
    const built = listFiles(tmp);
    const existing = listFiles(committed);
    const differences: string[] = [];
    for (const f of built) {
      if (!existing.includes(f)) { differences.push(`missing in dist/: ${f}`); continue; }
      if (!fs.readFileSync(path.join(tmp, f)).equals(fs.readFileSync(path.join(committed, f)))) differences.push(`stale: dist/${f}`);
    }
    for (const f of existing) if (!built.includes(f)) differences.push(`extra in dist/: ${f}`);
    return { fresh: differences.length === 0, differences };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (entry === import.meta.url) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const result = checkDist(root);
  if (result.fresh) {
    process.stdout.write('dist/ is fresh\n');
  } else {
    process.stderr.write(`dist/ is stale; run npm run build and commit:\n${result.differences.map((d) => `  ${d}`).join('\n')}\n`);
    process.exit(1);
  }
}
