/**
 * Vocabulary deny-list for shipped files. Product names and clean-room words
 * that must never appear in src/, skills/, hooks/, examples/, or README.md.
 * Escape hatch: put the literal ALLOW_MARKER on the same line.
 *
 * Patterns are word-bounded where the product name is also an ordinary word so
 * the lint does not fire on the harness's own vocabulary (for example the run
 * modes `express` and `sketch`, or the envelope field `next`).
 */

export const ALLOW_MARKER = 'harness-lint: allow';

const TICKET_SYSTEMS = [
  'jira', 'linear', 'asana', 'trello', 'clubhouse', 'youtrack', 'pivotal\\s*tracker',
  'monday\\.com', 'azure\\s*devops', 'shortcut\\.com', 'basecamp',
];

const CODE_HOSTS = [
  'github', 'gitlab', 'bitbucket', 'gitea', 'codeberg', 'azure\\s*repos', 'sourcehut',
];

const CHAT_TOOLS = ['slack', 'discord', 'microsoft\\s*teams', 'mattermost', 'zulip', 'rocket\\.chat'];

const DESIGN_TOOLS = ['figma', 'zeplin', 'invision', 'penpot', 'framer', 'adobe\\s*xd', 'canva', 'storybook'];

const REVIEW_BOTS = [
  'coderabbit', 'copilot', 'greptile', 'codium', 'qodo', 'sourcery', 'ellipsis', 'graphite',
  'reviewpad', 'dangerjs', 'codeclimate', 'sonarqube', 'sonarcloud', 'deepsource',
];

const FRONTEND_FRAMEWORKS = [
  'react', 'vue', 'angular', 'svelte', 'next\\.?js', 'nuxt', 'remix', 'astro', 'gatsby',
  'solid\\.?js', 'ember', 'tailwind', 'preact', 'qwik', 'lit-element',
];

const BACKEND_FRAMEWORKS = [
  'fastify', 'nest\\.?js', 'django', 'flask', 'rails', 'laravel', 'spring\\s*boot', 'koa',
  'hapi', 'phoenix', 'fastapi', 'sinatra', 'symfony', 'hono',
];

const DEPENDENCY_BOTS = ['dependabot', 'renovate', 'snyk', 'greenkeeper', 'mend\\.io'];

const MONOREPO_RUNNERS = ['nx', 'turborepo', 'turbo', 'lerna', 'bazel', 'moonrepo', 'rushjs', 'pants\\s*build'];

const PRODUCTS = [
  ...TICKET_SYSTEMS,
  ...CODE_HOSTS,
  ...CHAT_TOOLS,
  ...DESIGN_TOOLS,
  ...REVIEW_BOTS,
  ...FRONTEND_FRAMEWORKS,
  ...BACKEND_FRAMEWORKS,
  ...DEPENDENCY_BOTS,
  ...MONOREPO_RUNNERS,
];

/** Sibling-project vocabulary from the clean-room rule; matched as substrings. */
const CLEAN_ROOM = ['phase', 'orchestrat', 'dev-workflow', 'dev-mcp'];

export const DENY: RegExp[] = [
  ...PRODUCTS.map((p) => new RegExp(`\\b${p}\\b`, 'i')),
  ...CLEAN_ROOM.map((w) => new RegExp(w, 'i')),
];
