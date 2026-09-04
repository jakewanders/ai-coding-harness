export interface Frontmatter {
    data: Record<string, string>;
    body: string;
}
/** YAML frontmatter between leading `---` fences; scalars only. */
export declare function parseFrontmatter(text: string): Frontmatter;
/** Every `@root/<path>` reference, without the prefix, in first-seen order. */
export declare function extractRootRefs(text: string): string[];
export interface ToolCall {
    tool: string;
    action: string;
}
/** `tool action {...}` lines inside fenced ```harness blocks, in order. */
export declare function extractToolCalls(text: string): ToolCall[];
export interface SkillFile {
    name: string;
    file: string;
    text: string;
    frontmatter: Record<string, string>;
    body: string;
}
/** Every skills/<name>/SKILL.md under root (the _shared directory is prose, not a skill). */
export declare function listSkills(root: string): SkillFile[];
