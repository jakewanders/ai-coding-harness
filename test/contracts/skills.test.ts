import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findTool } from '../../src/registry/index.js';
import { CORE_ORDER } from '../../src/registry/stages.js';
import { extractRootRefs, extractToolCalls, listSkills, parseFrontmatter } from '../../src/skills/inspect.js';
import { repoRoot } from '../helpers/ctx.js';

const skills = listSkills(repoRoot);
const sharedDir = path.join(repoRoot, 'skills', '_shared');
const SHARED_FILES = ['style.md', 'scope-rules.md', 'severity.md', 'subagent-etiquette.md', 'standing-rules.md'];

describe('parseFrontmatter / extractors', () => {
  it('parses yaml frontmatter and returns the body', () => {
    const fm = parseFrontmatter('---\nname: x\ndescription: "Does x"\nstage: build\n---\n\n# X\nbody\n');
    expect(fm.data).toEqual({ name: 'x', description: 'Does x', stage: 'build' });
    expect(fm.body.trim()).toBe('# X\nbody');
    expect(parseFrontmatter('no frontmatter').data).toEqual({});
  });

  it('extracts @root references and fenced harness call templates', () => {
    const text = 'Read `@root/skills/_shared/style.md` and @root/skills/_shared/severity.md.\n\n```harness\nunit brief { "id": "<id>", "stage": "scope" }\nspec record { "id": "<id>" }\n```\n\n```json\n{"not": "a call"}\n```\n';
    expect(extractRootRefs(text)).toEqual(['skills/_shared/style.md', 'skills/_shared/severity.md']);
    expect(extractToolCalls(text)).toEqual([{ tool: 'unit', action: 'brief' }, { tool: 'spec', action: 'record' }]);
  });
});

describe('skills', () => {
  it('exist for every core stage with the required frontmatter', () => {
    const names = skills.map((s) => s.name);
    for (const stage of CORE_ORDER) expect(names, stage).toContain(stage);
    for (const s of skills) {
      expect(s.frontmatter.name, s.file).toBe(s.name);
      expect(s.frontmatter.description?.length ?? 0, s.file).toBeGreaterThan(10);
      expect(Boolean(s.frontmatter.stage) !== Boolean(s.frontmatter.flow), `${s.file} needs stage xor flow`).toBe(true);
      if (s.frontmatter.flow) expect(s.frontmatter['argument-hint'], s.file).toBe('<source> [id] [mode]');
    }
  });

  it('reference only @root paths that exist', () => {
    for (const s of skills) {
      const refs = extractRootRefs(s.text);
      expect(refs.length, `${s.file} should reference shared prose`).toBeGreaterThan(0);
      for (const ref of refs) expect(fs.existsSync(path.join(repoRoot, ref)), `${s.file} -> @root/${ref}`).toBe(true);
    }
    for (const shared of SHARED_FILES) {
      for (const ref of extractRootRefs(fs.readFileSync(path.join(sharedDir, shared), 'utf8'))) {
        expect(fs.existsSync(path.join(repoRoot, ref)), `${shared} -> @root/${ref}`).toBe(true);
      }
    }
  });

  it('name only registered tools and actions in call templates', () => {
    for (const s of skills) {
      const calls = extractToolCalls(s.text);
      expect(calls.length, `${s.file} should contain call templates`).toBeGreaterThan(0);
      for (const c of calls) {
        const tool = findTool(c.tool);
        expect(tool, `${s.file}: unknown tool ${c.tool}`).toBeDefined();
        expect(Object.keys(tool!.actions), `${s.file}: ${c.tool} ${c.action}`).toContain(c.action);
      }
    }
  });

  it('start every core stage skill with unit brief for that stage', () => {
    for (const stage of CORE_ORDER) {
      const s = skills.find((x) => x.name === stage)!;
      const first = extractToolCalls(s.text)[0];
      expect(first, s.file).toEqual({ tool: 'unit', action: 'brief' });
      const block = /```harness\n([\s\S]*?)```/.exec(s.text)![1]!;
      expect(block, s.file).toContain(`"stage": "${stage}"`);
    }
  });

  it('never inline shared prose', () => {
    for (const shared of SHARED_FILES) {
      const text = fs.readFileSync(path.join(sharedDir, shared), 'utf8');
      const marker = /<!--\s*distinctive:\s*(.+?)\s*-->/.exec(text)?.[1];
      expect(marker, `${shared} needs a distinctive marker sentence`).toBeTruthy();
      expect(text, shared).toContain(marker!);
      for (const s of skills) expect(s.text.includes(marker!), `${s.file} inlines ${shared}`).toBe(false);
      for (const other of SHARED_FILES.filter((f) => f !== shared)) {
        expect(fs.readFileSync(path.join(sharedDir, other), 'utf8').includes(marker!), `${other} inlines ${shared}`).toBe(false);
      }
    }
  });

  it('standing-rules holds the four blueprint rules plus the seat rule', () => {
    const text = fs.readFileSync(path.join(sharedDir, 'standing-rules.md'), 'utf8');
    const rules = text.split('\n').filter((l) => /^\d+\.\s/.test(l));
    expect(rules).toHaveLength(5);
    expect(text).toMatch(/scope/i);
    expect(text).toMatch(/cross-check/i);
    expect(text).toMatch(/remote refs/i);
    expect(text).toMatch(/approval/i);
    expect(text).toMatch(/unwired/i);
  });

  it('severity defines the four levels', () => {
    const text = fs.readFileSync(path.join(sharedDir, 'severity.md'), 'utf8');
    for (const level of ['blocker', 'major', 'minor', 'note']) expect(text).toMatch(new RegExp(`\\*\\*${level}\\*\\*`, 'i'));
  });

  it('ships mode files for exactly the stages whose skills reference them', () => {
    const skillsDir = path.join(repoRoot, 'skills');
    const withModes = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'modes')))
      .map((e) => e.name)
      .sort();
    expect(withModes).toEqual(['build', 'publish', 'review']);
    for (const stage of withModes) {
      const files = fs.readdirSync(path.join(skillsDir, stage, 'modes')).sort();
      expect(files, stage).toEqual(['sketch.md']);
      const skill = skills.find((s) => s.name === stage)!;
      for (const f of files) {
        expect(skill.text, `${stage} must reference modes/${f}`).toContain(`@root/skills/${stage}/modes/${f}`);
        const text = fs.readFileSync(path.join(skillsDir, stage, 'modes', f), 'utf8');
        expect(text.trim().length, `${stage}/modes/${f}`).toBeGreaterThan(40);
        for (const ref of extractRootRefs(text)) expect(fs.existsSync(path.join(repoRoot, ref)), `${stage}/modes/${f} -> @root/${ref}`).toBe(true);
      }
      expect(skill.text).toMatch(/if the header mode is/i);
    }
    for (const s of skills) {
      if (!withModes.includes(s.name)) expect(s.text, `${s.file} references a mode file without shipping one`).not.toMatch(/\/modes\//);
    }
  });
});
