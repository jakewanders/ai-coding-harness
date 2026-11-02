# History

These files are the planning and prompt artifacts from building the harness with an autonomous agent loop: the master prompt that drove the loop, the task-by-task build plan, the running build log, and the plan for the later "lean" pass. They are kept for provenance only.

They are not user documentation, and they describe intermediate states (for example, tool and stage counts that changed later). Some paths they mention, such as `docs/history/BLOCKERS.md`, were removed because the file was never used. For current behavior, see `../README.md`, `../blueprint.md`, `../tools.md` and the specs.

Terms in these files predate the vocabulary rename and are left as written: the stage ids `scope`, `verify`, `publish` and `close` are now `define`, `walkthrough`, `pr` and `wrap_up`; `seats` are now `roles`; the `convoy` flow is now `batch`; and the `pilot` flow is now `conductor`. The same applies to `blueprint.md` and the original specs under `superpowers/specs/`, which describe the design as first written. See the root `CHANGELOG.md` for the mapping.
