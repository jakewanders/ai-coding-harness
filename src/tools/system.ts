import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { inferProfile } from '../config/infer.js';
import { findGitRoot } from '../config/load.js';
import { validateLayer } from '../config/validate.js';
import { parseYamlDocument, documentError } from '../config/yaml.js';
import { provenance, renderDoctor, runDoctor } from '../system/doctor.js';
import { mapToolsToSeats, unmappedTools } from '../setup/seat-heuristics.js';
import { stringify as stringifyYaml } from 'yaml';
import { envelope } from '../contracts/envelope.js';
import { VERSION } from '../index.js';
import { action, defineTool, fail, result } from '../registry/tools.js';

export const systemTool = defineTool({
  name: 'system',
  description: 'Engine housekeeping: version, health, kits, doctor, configuration, inference and seat mapping.',
  actions: {
    version: action({
      describe: 'Report the engine version.',
      schema: z.object({}),
      handler: async () => result(`harness ${VERSION}`, envelope(true, `version ${VERSION}`, { version: VERSION })),
    }),
    health: action({
      describe: 'Report whether the vault is initialized and which Node runs the server.',
      schema: z.object({}),
      handler: async (_input, ctx) => {
        const vault = fs.existsSync(path.join(ctx.vault, '.git')) ? 'ok' : 'missing';
        const data = { vault, node: process.version };
        const text = vault === 'ok' ? `Vault ok at ${ctx.vault}. Node ${process.version}.` : `Vault missing at ${ctx.vault}; it is created on first unit start. Node ${process.version}.`;
        return result(text, envelope(true, `vault ${vault}`, data));
      },
    }),
    kits: action({
      describe: 'List the kits loaded for this checkout with their docs, rules and gate overrides.',
      schema: z.object({}),
      handler: async (_input, ctx) => {
        const kits = (ctx.config.kits ?? []).map((k) => ({ name: k.name, dir: k.dir, docs: k.docs.length, rules: k.rules.length, gate_overrides: Object.keys(k.fragment.gates ?? {}) }));
        const wanted = ctx.config.config.kits ?? [];
        const missing = wanted.filter((n) => !kits.some((k) => k.name === n));
        const lines = kits.length ? kits.map((k) => `- ${k.name} (${k.dir}): ${k.docs} doc(s), ${k.rules} rule(s)${k.gate_overrides.length ? `, overrides ${k.gate_overrides.join(', ')}` : ''}`) : ['No kits loaded.'];
        if (missing.length) lines.push(`Missing: ${missing.join(', ')} (not found on the kit search path).`);
        return result(lines.join('\n'), envelope(missing.length === 0, `${kits.length} kit(s)`, { kits, missing }));
      },
    }),
    doctor: action({
      describe: 'Read-only report: inferred profile with evidence, config layers and errors, seats, kits, environments, vault and build health, plus a proposed .harness.yaml.',
      schema: z.object({}),
      handler: async (_input, ctx) => {
        const report = runDoctor(ctx);
        const healthy = report.errors.length === 0 && report.build.matches;
        return result(renderDoctor(report), envelope(healthy, healthy ? 'healthy' : `${report.errors.length} config error(s)${report.build.matches ? '' : ', build stale'}`, report));
      },
    }),
    config: action({
      describe: 'merged: effective config with provenance; propose: the doctor proposal; write: save approved YAML as .harness.yaml (refuses to overwrite without overwrite: true).',
      schema: z.object({
        mode: z.enum(['merged', 'propose', 'write']),
        yaml: z.string().optional().describe('Approved YAML text to write (write mode).'),
        overwrite: z.boolean().optional().describe('Allow replacing an existing .harness.yaml.'),
      }),
      handler: async (input, ctx) => {
        if (input.mode === 'merged') {
          const map = provenance(ctx);
          const lines = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `- ${k}: ${v}`);
          return result(lines.join('\n'), envelope(true, `${lines.length} setting(s)`, { config: ctx.config.config, provenance: map, errors: ctx.config.errors }));
        }
        if (input.mode === 'propose') {
          const report = runDoctor(ctx);
          return result(report.proposed_repo_config, envelope(true, 'proposal rendered', { yaml: report.proposed_repo_config, namespace: report.profile.namespace }));
        }
        if (!input.yaml) return fail('system config write: pass the approved YAML as `yaml`; use mode propose to get a draft');
        const root = findGitRoot(ctx.cwd);
        if (!root) return fail(`system config write: ${ctx.cwd} is not inside a git checkout`);
        const file = path.join(root, '.harness.yaml');
        if (fs.existsSync(file) && !input.overwrite) return fail(`system config write: ${file} exists; pass overwrite: true to replace it`);
        const located = parseYamlDocument(input.yaml);
        const syntax = documentError(located, file);
        if (syntax) return fail(`system config write: ${syntax.message}${syntax.line !== null ? ` (line ${syntax.line})` : ''}`);
        const validated = validateLayer(located.doc.toJS() ?? {}, file, located);
        if ('error' in validated) return fail(`system config write: invalid config at ${validated.error.path || '(root)'}: ${validated.error.message}`, validated.error);
        fs.writeFileSync(file, input.yaml);
        return result(`Wrote ${file}.`, envelope(true, 'config written', { file, overwritten: Boolean(input.overwrite) }));
      },
    }),
    infer: action({
      describe: 'Zero-config inference of the repo profile, each guess with its evidence.',
      schema: z.object({}),
      handler: async (_input, ctx) => {
        const profile = inferProfile(ctx.cwd);
        const lines = [`namespace: ${profile.namespace}`, ...profile.guesses.map((g) => `- ${g.field}: \`${g.value}\` — ${g.evidence}`)];
        return result(lines.join('\n'), envelope(true, `${profile.guesses.length} guess(es)`, profile));
      },
    }),
    seats: action({
      describe: "Map the session's visible tool names onto seats by name heuristics; returns the mapping, the unmapped tools and a seats YAML fragment.",
      schema: z.object({ tools: z.array(z.string()).describe('Every tool name visible in the session.') }),
      handler: async (input) => {
        const seats = mapToolsToSeats(input.tools);
        const unmapped = unmappedTools(input.tools, seats);
        const fragment: Record<string, Record<string, string[]>> = {};
        if (seats.tracker.length) fragment.tracker = { fetch: seats.tracker, comment: seats.tracker, transition_hint: seats.tracker };
        if (seats.codehost.length) fragment.codehost = { open_pr: seats.codehost, read_threads: seats.codehost, comment: seats.codehost, resolve_thread: seats.codehost, attach: seats.codehost };
        if (seats.docs.length) fragment.docs = { search: seats.docs };
        if (seats.design.length) fragment.design = { fetch: seats.design };
        if (seats.chat.length) fragment.chat = { post: seats.chat };
        if (seats.reviewbot.length) fragment.reviewbot = { status: seats.reviewbot, threads: seats.reviewbot };
        const yaml = stringifyYaml({ seats: fragment }, { lineWidth: 0 });
        const lines = [...Object.entries(seats).map(([seat, names]) => `- ${seat}: ${names.length ? names.join(', ') : 'unwired'}`), `unmapped: ${unmapped.length ? unmapped.join(', ') : 'none'}`, '', 'Proposed seats fragment (refine which tool does which action):', '', yaml.trimEnd()];
        return result(lines.join('\n'), envelope(true, `${input.tools.length - unmapped.length} tool(s) mapped, ${unmapped.length} unmapped`, { seats, unmapped, yaml }));
      },
    }),
  },
});
