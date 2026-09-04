import type { HarnessConfig } from './schema.js';

/** Built-in defaults; the bottom configuration layer. */
export const DEFAULTS: HarnessConfig = {
  schema: 1,
  store: { path: '~/.harness/vault', remote: null },
  seats: {
    tracker: { fetch: [], comment: [], transition_hint: [] },
    codehost: { open_pr: [], read_threads: [], comment: [], resolve_thread: [], attach: [] },
    docs: { search: [] },
    design: { fetch: [] },
    chat: { post: [] },
    reviewbot: { status: [], threads: [] },
    counterweight: { cli: null, http: null },
  },
  repos: {},
  environments: [],
  tickets: [],
  gates: {},
  custom_gates: [],
  modes: {},
  kits: [],
  protected_branches: ['main', 'master', 'release/*'],
  diffaudit: { rules: [] },
};
