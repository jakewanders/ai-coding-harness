import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/index.js';
import { REAL_HOME, makeTmpDir, withEnv } from './helpers/tmp.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8')) as { version: string };

describe('scaffold', () => {
  it('VERSION matches package.json', () => {
    expect(VERSION).toBe(pkg.version);
  });

  it('hermetic env points HARNESS_VAULT and HARNESS_CONFIG away from the real home', () => {
    const vault = process.env.HARNESS_VAULT;
    const config = process.env.HARNESS_CONFIG;
    expect(vault).toBeTruthy();
    expect(config).toBeTruthy();
    expect(vault!.startsWith(REAL_HOME)).toBe(false);
    expect(config!.startsWith(REAL_HOME)).toBe(false);
    expect(vault!.startsWith(os.tmpdir())).toBe(true);
    expect(config!.startsWith(os.tmpdir())).toBe(true);
  });

  it('os.homedir() resolves to the HARNESS_HOME temp dir', () => {
    const home = process.env.HARNESS_HOME;
    expect(home).toBeTruthy();
    expect(os.homedir()).toBe(home);
    expect(home).not.toBe(REAL_HOME);
    expect(fs.existsSync(home!)).toBe(true);
  });
});

describe('test helpers', () => {
  it('makeTmpDir creates a fresh directory under the OS temp root', () => {
    const a = makeTmpDir('harness-smoke');
    const b = makeTmpDir('harness-smoke');
    expect(a).not.toBe(b);
    expect(a.startsWith(os.tmpdir())).toBe(true);
    expect(fs.statSync(a).isDirectory()).toBe(true);
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  });

  it('withEnv sets variables for the callback and restores them afterwards', async () => {
    const before = process.env.HARNESS_SMOKE_X;
    expect(before).toBeUndefined();
    await withEnv({ HARNESS_SMOKE_X: 'on' }, async () => {
      expect(process.env.HARNESS_SMOKE_X).toBe('on');
    });
    expect(process.env.HARNESS_SMOKE_X).toBeUndefined();
    await expect(
      withEnv({ HARNESS_SMOKE_X: 'again' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(process.env.HARNESS_SMOKE_X).toBeUndefined();
  });
});
