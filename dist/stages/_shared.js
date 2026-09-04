/** Heading, purpose sentence, and the unit-brief follow-up template. */
export function stageBrief(info, ctx, body = []) {
    const id = ctx.state?.id ?? ctx.header.unit;
    const lines = [`# ${info.name}`, '', info.purpose, ''];
    if (body.length)
        lines.push(...body, '');
    lines.push('## Produces', '', ...info.outputs.map((o) => `- ${o}`), '');
    lines.push('## Next', '', `When this stage is complete, call \`unit advance\` with id \`${id}\`. If it refuses, follow the remedies it lists,`, `then call \`unit brief\` with id \`${id}\` for the next stage's brief.`);
    return lines.join('\n');
}
/** Brief for a standalone flow whose renderer has not landed yet. */
export function flowStub(name) {
    return () => `# ${name}\n\nStandalone flow \`${name}\`; follow its skill as written. The engine keeps no unit state for this brief unless one is named.`;
}
