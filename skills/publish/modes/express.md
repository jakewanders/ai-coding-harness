# publish — express mode

- The PR body lists the two demotions (`reach_audit_recorded`, `counterweight_consulted`) and a `## Not proven` section; do not edit them out.
- Verify runs after publish: mark the PR as not ready for merge (draft) if the codehost seat supports it, and say in the body that a browser pass follows.
- Record the PR, then route; the engine sends the unit to verify next when the repo declares `browser_ui`.
