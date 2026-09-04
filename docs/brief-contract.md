# Brief header contract `harness-brief/1`

Every `unit brief` response opens with a fenced `yaml` block. Its first key is always
`contract: harness-brief/1`. A skill reads this block before any prose; if the contract
string is not the one it was written against it stops and reports rather than guessing.

```yaml
contract: harness-brief/1
unit: ABC-123
mode: thorough
stage: build
repo: example.test/owner/name
worktree: ~/code/name-ABC-123
base_branch: main
root: /abs/plugin/root
seats:
  tracker: [mcp__tracker__get_issue]
  codehost: unwired
  docs: unwired
  design: unwired
  chat: unwired
  reviewbot: unwired
capabilities:
  isolation: worktree
  browser_ui: true
gates:
  - { id: self_critique_recorded, severity: block, status: pass }
docs:
  - /abs/path/to/convention.md
config_errors:
  - { file: ~/.harness/config.yaml, path: modes.default, line: 4, message: unknown mode }
```

## Keys

| Key | Type | Meaning |
|---|---|---|
| `contract` | literal `harness-brief/1` | Contract version. Bumped only on an incompatible change. |
| `unit` | string | Unit id, usually the ticket key. |
| `mode` | string | Resolved run mode name (`thorough`, `express`, `sketch`, or a kit-defined mode). |
| `stage` | string | Stage or flow this brief was rendered for. |
| `repo` | string | Repo namespace derived from the remote, or the directory name when there is none. |
| `worktree` | string or null | Home-relative path of the unit's worktree, `null` when working in place. |
| `base_branch` | string | Branch the unit will merge into. |
| `root` | string | Absolute plugin install root. Prose refers to it as `@root/`. |
| `seats` | map of seat → list of tool names or `unwired` | Which session tools fill each capability seat: `tracker`, `codehost`, `docs`, `design`, `chat`, `reviewbot`. |
| `capabilities` | map | Repo profile capabilities such as `isolation` and `browser_ui`. |
| `gates` | list of `{ id, severity, status }` | Gates for this stage. `severity` is `block`, `warn`, or `off`; `status` is `pass`, `fail`, or `n/a`. |
| `docs` | list of absolute paths | Convention documents selected for this unit. |
| `config_errors` | list of `{ file, path, line, message, valid_keys? }` | Problems found while loading configuration layers. Never silently dropped. |

The header is followed by the seat-wiring block, any configuration problems in prose, the
source/spec block, then stage-specific material.
