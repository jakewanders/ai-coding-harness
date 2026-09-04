import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach } from 'vitest';
import { makeTmpDir } from './helpers/tmp.js';

const MANAGED_KEYS = ['HARNESS_VAULT', 'HARNESS_CONFIG', 'HARNESS_HOME', 'HOME'] as const;

let saved: Record<string, string | undefined> = {};
let created: string[] = [];

beforeEach(() => {
  saved = {};
  for (const key of MANAGED_KEYS) saved[key] = process.env[key];

  const home = makeTmpDir('harness-home');
  const vault = makeTmpDir('harness-vault');
  const configDir = makeTmpDir('harness-config');
  created = [home, vault, configDir];

  process.env.HARNESS_HOME = home;
  process.env.HOME = home;
  process.env.HARNESS_VAULT = vault;
  process.env.HARNESS_CONFIG = path.join(configDir, 'config.yaml');
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
  created = [];
});
