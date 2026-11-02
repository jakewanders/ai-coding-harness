import fs from 'node:fs';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { seatWiring } from '../brief/seats.js';
import { DEFAULTS } from '../config/defaults.js';
import { inferProfile } from '../config/infer.js';
import { findGitRoot, loadFileLayer, userConfigPath } from '../config/load.js';
import { remoteUrl } from '../git/exec.js';
import { VERSION } from '../index.js';
import { homeRelative } from '../store/paths.js';
/** YAML for a `.harness.yaml` built from the inferred profile. */
export function proposeRepoConfig(profile) {
    const get = (field) => profile.guesses.find((g) => g.field === field)?.value;
    const commands = {};
    for (const name of ['check', 'test', 'lint', 'typecheck', 'e2e', 'boot', 'install']) {
        const v = get(`commands.${name}`);
        if (v)
            commands[name] = v;
    }
    const repo = { base_branch: get('base_branch') ?? 'main' };
    if (Object.keys(commands).length)
        repo.commands = commands;
    const pm = get('package_manager');
    if (pm)
        repo.constraints = { package_manager: pm };
    repo.capabilities = { isolation: 'worktree', browser_ui: false };
    const doc = { schema: 1, repos: { [profile.namespace]: repo } };
    const header = ['# Proposed by `system doctor` from repository inference.', ...profile.guesses.map((g) => `# ${g.field}: ${g.value}  (${g.evidence})`)].join('\n');
    return `${header}\n${stringifyYaml(doc, { lineWidth: 0 })}`;
}
function buildHealth(root) {
    const file = path.join(root, 'dist', 'index.js');
    if (!fs.existsSync(file))
        return { dist: false, version: null, matches: false };
    const version = /VERSION\s*=\s*['"]([^'"]+)['"]/.exec(fs.readFileSync(file, 'utf8'))?.[1] ?? null;
    return { dist: true, version, matches: version === VERSION };
}
/** Read-only health and configuration report for the current checkout. */
export function runDoctor(ctx) {
    const profile = inferProfile(ctx.cwd);
    const vaultGit = fs.existsSync(path.join(ctx.vault, '.git'));
    return {
        profile,
        layers: ctx.config.layers,
        errors: ctx.config.errors,
        deprecations: ctx.config.deprecations ?? [],
        seats: seatWiring(ctx.config.config),
        kits: ctx.config.kits.map((k) => ({ name: k.name, dir: k.dir, docs: k.docs.length, rules: k.rules.length })),
        environments: ctx.config.config.environments ?? [],
        vault: { path: homeRelative(ctx.vault), exists: fs.existsSync(ctx.vault), git: vaultGit, remote: vaultGit ? remoteUrl(ctx.vault) : null },
        build: buildHealth(ctx.root),
        proposed_repo_config: proposeRepoConfig(profile),
    };
}
export function renderDoctor(r) {
    const lines = ['# harness doctor', '', `## Repo profile (${r.profile.namespace})`, ''];
    lines.push(...(r.profile.guesses.length ? r.profile.guesses.map((g) => `- ${g.field}: \`${g.value}\` — ${g.evidence}`) : ['- nothing inferred']));
    lines.push('', '## Config layers', '', ...r.layers.map((l) => `- ${l.name}: ${l.file ?? '(none)'} ${l.ok ? 'ok' : 'SKIPPED'}`));
    if (r.errors.length)
        lines.push('', 'Problems:', ...r.errors.map((e) => `- ${e.file}${e.line !== null ? `:${e.line}` : ''} ${e.path ? `at ${e.path}: ` : ''}${e.message}`));
    if (r.deprecations.length)
        lines.push('', 'Deprecated (still accepted, please update the file):', ...r.deprecations.map((d) => `- ${d}`));
    lines.push('', '## Seats', '', ...Object.entries(r.seats).map(([seat, w]) => `- ${seat}: ${w === 'unwired' ? 'unwired' : w.join(', ')}`));
    lines.push('', '## Kits', '', ...(r.kits.length ? r.kits.map((k) => `- ${k.name}: ${k.docs} doc(s), ${k.rules} rule(s)`) : ['- none']));
    lines.push('', '## Environments', '', ...(r.environments.length ? r.environments.map((e) => `- ${e.name} (${e.role ?? 'no role'}): ${e.url ?? 'no url'}`) : ['- none']));
    lines.push('', '## Vault', '', `- path: ${r.vault.path}`, `- exists: ${r.vault.exists}, git: ${r.vault.git}, remote: ${r.vault.remote ?? 'none'}`);
    lines.push('', '## Build', '', `- dist present: ${r.build.dist}; dist version ${r.build.version ?? 'unknown'} ${r.build.matches ? 'matches' : 'does NOT match'} package ${VERSION}`);
    lines.push('', '## Proposed .harness.yaml', '', '```yaml', r.proposed_repo_config.trimEnd(), '```');
    return lines.join('\n');
}
/** `key.path → layer` for every leaf of the merged config. */
export function provenance(ctx) {
    const layers = [{ name: 'defaults', config: DEFAULTS }];
    for (const k of ctx.config.kits)
        layers.push({ name: `kit:${k.name}`, config: k.fragment });
    const user = loadFileLayer('user', userConfigPath(ctx.env));
    if (user.config)
        layers.push({ name: 'user', config: user.config });
    const root = findGitRoot(ctx.cwd);
    const repo = loadFileLayer('repo', root ? path.join(root, '.harness.yaml') : null);
    if (repo.config)
        layers.push({ name: 'repo', config: repo.config });
    const out = {};
    const walk = (value, prefix, layer) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length) {
            for (const [k, v] of Object.entries(value))
                walk(v, prefix ? `${prefix}.${k}` : k, layer);
        }
        else if (value !== undefined) {
            out[prefix] = layer;
        }
    };
    for (const layer of layers)
        walk(layer.config, '', layer.name);
    return out;
}
