import { registerRenderer, type BriefRenderer } from '../registry/stages.js';

export const render: BriefRenderer = (ctx) => {
  const codehost = ctx.header.seats.codehost;
  const lines = ['# botprs', '', 'Classify open dependency-bot pull requests into auto-merge, needs-review, or hold. Nothing is merged from this flow; it produces a classified list and a digest.', ''];
  lines.push('## Listing');
  if (codehost === 'unwired') {
    lines.push('', 'The codehost seat is unwired: you cannot list PRs from here. Skip and say so in your report, or ask the user to paste the open bot PRs (title, packages, version bump, changed files).');
  } else {
    lines.push('', `List open PRs authored by dependency bots with the codehost tools (${codehost.join(', ')}). For each, read the title, the packages and version bump, and the changed file list.`);
  }
  lines.push('', '## Heuristics', '',
    '- auto-merge: a patch or minor semver bump of a dev-only or well-pinned dependency, the diff touches only the lockfile (plus the manifest line for that package), and checks are green.',
    '- needs-review: a major semver bump, a runtime dependency whose changelog mentions behavior changes, more than one package in a single PR, or any non-lockfile source change.',
    '- hold: checks failing, a security advisory that needs a coordinated fix, a package the repo pins on purpose (ledger asks), or anything you cannot read.',
    '', 'When in doubt, needs-review. Never move a PR to auto-merge because its title says it is safe; look at the diff.', '',
    '## Output', '', 'One line per PR: `<number> · <package> <from> → <to> · <bucket> · <reason>`. Then write one digest for the batch so later runs can recall the decisions.', '',
    '```harness', 'digest write { "id": "<batch unit id>", "summary": "<n> bot PRs classified: <a> auto-merge, <b> needs-review, <c> hold", "decisions": ["<number>: <bucket> — <reason>"], "tags": ["botprs"] }', '```', '',
    'Merging or closing PRs happens through the codehost seat only with the user\'s approval.');
  return lines.join('\n');
};

registerRenderer('botprs', render);
