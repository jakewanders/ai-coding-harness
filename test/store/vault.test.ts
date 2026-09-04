import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureUnitDir, ensureVault } from '../../src/store/vault.js';
import { unitDir } from '../../src/store/paths.js';
import { makeTmpDir } from '../helpers/tmp.js';

describe('ensureVault', () => {
  it('creates the directory and git-initializes it', () => {
    const root = path.join(makeTmpDir('harness-vault-t'), 'nested', 'vault');
    ensureVault(root);
    expect(fs.statSync(path.join(root, '.git')).isDirectory()).toBe(true);
  });

  it('is idempotent and does not re-init an existing repository', () => {
    const root = makeTmpDir('harness-vault-t');
    ensureVault(root);
    const head = path.join(root, '.git', 'HEAD');
    const before = fs.statSync(head).mtimeMs;
    fs.writeFileSync(path.join(root, 'marker.txt'), 'keep');
    ensureVault(root);
    expect(fs.statSync(head).mtimeMs).toBe(before);
    expect(fs.readFileSync(path.join(root, 'marker.txt'), 'utf8')).toBe('keep');
  });
});

describe('ensureUnitDir', () => {
  it('creates the unit directory with reviews, runs and drafts', () => {
    const vault = makeTmpDir('harness-vault-t');
    const dir = ensureUnitDir(vault, 'local/proj', 'ABC-7');
    expect(dir).toBe(unitDir(vault, 'local/proj', 'ABC-7'));
    for (const sub of ['reviews', 'runs', 'drafts']) {
      expect(fs.statSync(path.join(dir, sub)).isDirectory()).toBe(true);
    }
    expect(ensureUnitDir(vault, 'local/proj', 'ABC-7')).toBe(dir);
  });
});
