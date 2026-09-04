import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allTools } from '../../src/registry/index.js';
import { describeTool } from '../../src/registry/tools.js';
import { renderToolsDoc } from '../../src/scripts/gen-tools.js';
import { repoRoot } from '../helpers/ctx.js';

describe('tool inventory', () => {
  it('registers one tool per file in src/tools', () => {
    const files = fs.readdirSync(path.join(repoRoot, 'src', 'tools')).filter((f) => f.endsWith('.ts'));
    expect(allTools().length).toBe(files.length);
    expect(new Set(allTools().map((t) => t.name)).size).toBe(allTools().length);
  });

  it('computes every description from the registry', () => {
    for (const t of allTools()) {
      expect(describeTool(t)).toMatch(/ Actions: .+\.$/);
      expect(Object.keys(t.actions).length).toBeGreaterThan(0);
    }
  });

  it('keeps docs/tools.md in sync with the generator', () => {
    const doc = fs.readFileSync(path.join(repoRoot, 'docs', 'tools.md'), 'utf8');
    expect(doc).toBe(renderToolsDoc(allTools()));
  });
});
