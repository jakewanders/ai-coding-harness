import type { BriefRenderer } from '../registry/stages.js';

/** One-line stub brief for a stage or flow whose renderer is not written yet. */
export function placeholderRenderer(name: string): BriefRenderer {
  return (ctx) => {
    const unit = ctx.state ? ctx.state.id : ctx.header.unit;
    return `# ${name}\n\nBrief for \`${name}\` (unit ${unit}) is not implemented yet; follow the stage skill as written.`;
  };
}
