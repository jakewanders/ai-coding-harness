# Build log

One line per completed task: `NN · title · tests <n> · note`.

01 · Project scaffold and hermetic test harness · tests 5 · Setup also rewrites HOME so os.homedir() lands in the temp home; typescript 7.0.2 and vitest 5 pinned exact.
02 · Vocabulary lint · tests 12 · Product names are word-bounded so the run modes express/sketch and the envelope field next do not trip the lint; clean-room words match as substrings.
03 · Result envelope and brief header contracts · tests 24 · SeatName, Severity and ConfigError are defined once in contracts/header.ts; config/schema.ts, config/load.ts and registry/gates.ts will re-export them.
04 · Vault paths and repo namespace · tests 38 · repoNamespace lowercases the host and keeps nested group paths; ensureVault uses init.defaultBranch=main so it is quiet under a temp HOME.
05 · Unit state, migrations, history · tests 48 · Zod schema lives in store/schema.ts to avoid a state/migrations import cycle; evidence/kinds.ts created early with the kind names only.
06 · Configuration layers · tests 60 · valid_keys comes from walking the zod def tree (object/record/array/optional); fixed a millisecond-flaky round-trip expectation in the state test.
07 · Zero-config repo inference · tests 75 · Test repos get their bare origin through git clone --bare plus fetch and remote set-head, so no test ever runs git push.
