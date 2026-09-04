# build — express mode

Express thins the pipeline without skipping stages. In build:

- Work the plan in criterion order and run the check command after each criterion, not after each file.
- Reach-audit and counterweight gates are advisory (warn) in this mode; still record `reach_audit` if you add a new surface, because the PR body will list the demotion.
- Verify runs after publish: do not boot a browser here, but leave `## Verify later` notes in `plan.md` naming the criteria that need a browser pass.
