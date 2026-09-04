import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { expandHome, homeRelative, repoNamespace, unitDir, vaultRoot } from '../../src/store/paths.js';

describe('homeRelative / expandHome', () => {
  it('collapses a path under home to ~/ and expands it back', () => {
    expect(homeRelative('/tmp/h/x', '/tmp/h')).toBe('~/x');
    expect(homeRelative('/tmp/h/a/b.json', '/tmp/h')).toBe('~/a/b.json');
    expect(expandHome('~/x', '/tmp/h')).toBe('/tmp/h/x');
    expect(expandHome(homeRelative('/tmp/h/x', '/tmp/h'), '/tmp/h')).toBe('/tmp/h/x');
  });

  it('maps home itself to ~ and does not collapse sibling prefixes', () => {
    expect(homeRelative('/tmp/h', '/tmp/h')).toBe('~');
    expect(expandHome('~', '/tmp/h')).toBe('/tmp/h');
    expect(homeRelative('/tmp/hh/x', '/tmp/h')).toBe('/tmp/hh/x');
  });

  it('passes non-home paths through unchanged', () => {
    expect(homeRelative('/var/lib/x', '/tmp/h')).toBe('/var/lib/x');
    expect(expandHome('/var/lib/x', '/tmp/h')).toBe('/var/lib/x');
    expect(expandHome('relative/x', '/tmp/h')).toBe('relative/x');
  });

  it('defaults home to HARNESS_HOME', () => {
    const home = process.env.HARNESS_HOME!;
    expect(homeRelative(path.join(home, 'k'))).toBe('~/k');
    expect(expandHome('~/k')).toBe(path.join(home, 'k'));
  });
});

describe('vaultRoot', () => {
  it('prefers HARNESS_VAULT', () => {
    expect(vaultRoot({ HARNESS_VAULT: '/v1', HARNESS_HOME: '/h' }, '/v2')).toBe('/v1');
  });

  it('then the configured store path, expanding ~', () => {
    expect(vaultRoot({ HARNESS_HOME: '/h' }, '/v2')).toBe('/v2');
    expect(vaultRoot({ HARNESS_HOME: '/h' }, '~/store')).toBe('/h/store');
  });

  it('then ~/.harness/vault under HARNESS_HOME', () => {
    expect(vaultRoot({ HARNESS_HOME: '/h' })).toBe('/h/.harness/vault');
    expect(vaultRoot({ HARNESS_HOME: '/h' }, null)).toBe('/h/.harness/vault');
  });

  it('reads process.env by default', () => {
    expect(vaultRoot()).toBe(process.env.HARNESS_VAULT);
  });
});

describe('repoNamespace', () => {
  it('derives host/owner/name from ssh and https remotes', () => {
    expect(repoNamespace('git@github.com:o/n.git', 'n')).toBe('github.com/o/n'); // harness-lint: allow
    expect(repoNamespace('https://github.com/o/n.git', 'n')).toBe('github.com/o/n'); // harness-lint: allow
    expect(repoNamespace('https://github.com/o/n', 'n')).toBe('github.com/o/n'); // harness-lint: allow
    expect(repoNamespace('ssh://git@example.test:2222/o/n.git', 'n')).toBe('example.test/o/n');
    expect(repoNamespace('https://user@example.test/group/sub/n.git', 'n')).toBe('example.test/group/sub/n');
  });

  it('falls back to local/<dir> without a remote or with an unparseable one', () => {
    expect(repoNamespace(null, 'dir')).toBe('local/dir');
    expect(repoNamespace('', 'dir')).toBe('local/dir');
    expect(repoNamespace('not a url', 'dir')).toBe('local/dir');
  });
});

describe('unitDir', () => {
  it('joins vault, namespace, units and id', () => {
    expect(unitDir('/v', 'example.test/o/n', 'ABC-1')).toBe('/v/example.test/o/n/units/ABC-1');
  });
});
