import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectShipped, scanFiles } from '../../src/lint/scan.js';
import { makeTmpDir } from '../helpers/tmp.js';
import { ALLOW_MARKER, DENY } from './denylist.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('scanFiles', () => {
  it('reports a denied term with its file and line', () => {
    const dir = makeTmpDir('harness-lint');
    const file = path.join(dir, 'fixture.md');
    fs.writeFileSync(file, ['clean line', 'we sync tickets to JIRA here', 'another clean line'].join('\n'));
    const hits = scanFiles([file], DENY, ALLOW_MARKER);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ file, line: 2 });
    expect(hits[0]!.term.toLowerCase()).toBe('jira');
  });

  it('ignores a denied term on a line carrying the allow marker', () => {
    const dir = makeTmpDir('harness-lint');
    const file = path.join(dir, 'fixture.ts');
    fs.writeFileSync(file, `const host = 'github'; // ${ALLOW_MARKER}\n`);
    expect(scanFiles([file], DENY, ALLOW_MARKER)).toEqual([]);
  });

  it('reports one hit per denied term per line', () => {
    const dir = makeTmpDir('harness-lint');
    const file = path.join(dir, 'fixture.txt');
    fs.writeFileSync(file, 'slack and figma\nphase two\n');
    const hits = scanFiles([file], DENY, ALLOW_MARKER);
    expect(hits.map((h) => [h.line, h.term.toLowerCase()])).toEqual([
      [1, 'slack'],
      [1, 'figma'],
      [2, 'phase'],
    ]);
  });

  it('does not fire on the harness vocabulary that overlaps product names', () => {
    const dir = makeTmpDir('harness-lint');
    const file = path.join(dir, 'fixture.txt');
    fs.writeFileSync(file, 'modes: thorough, express, sketch\nnext: NextAction[]\ncontext.reaction\n');
    expect(scanFiles([file], DENY, ALLOW_MARKER)).toEqual([]);
  });
});

describe('collectShipped', () => {
  it('lists shipped files and excludes dist, node_modules, docs and test', () => {
    const root = makeTmpDir('harness-shipped');
    for (const d of ['src/deep', 'skills/scope', 'hooks', 'examples/kits/x', 'dist', 'node_modules/p', 'docs', 'test', 'src/node_modules/q']) {
      fs.mkdirSync(path.join(root, d), { recursive: true });
    }
    const files = {
      'src/a.ts': 1, 'src/deep/b.ts': 1, 'skills/scope/SKILL.md': 1, 'hooks/guard.mjs': 1,
      'examples/kits/x/kit.yaml': 1, 'README.md': 1,
      'dist/a.js': 0, 'node_modules/p/index.js': 0, 'docs/blueprint.md': 0, 'test/a.test.ts': 0,
      'src/node_modules/q/index.js': 0, 'package.json': 0,
    };
    for (const f of Object.keys(files)) fs.writeFileSync(path.join(root, f), 'x');
    const got = collectShipped(root).map((f) => path.relative(root, f)).sort();
    const want = Object.entries(files).filter(([, keep]) => keep).map(([f]) => f).sort();
    expect(got).toEqual(want);
  });

  it('tolerates missing directories', () => {
    const root = makeTmpDir('harness-shipped');
    fs.writeFileSync(path.join(root, 'README.md'), 'x');
    expect(collectShipped(root).map((f) => path.relative(root, f))).toEqual(['README.md']);
  });
});

describe('shipped vocabulary', () => {
  it('has zero denied terms in the real repository', () => {
    const hits = scanFiles(collectShipped(repoRoot), DENY, ALLOW_MARKER);
    expect(hits).toEqual([]);
  });
});
