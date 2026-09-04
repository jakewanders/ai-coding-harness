# Build log

One line per completed task: `NN · title · tests <n> · note`.

01 · Project scaffold and hermetic test harness · tests 5 · Setup also rewrites HOME so os.homedir() lands in the temp home; typescript 7.0.2 and vitest 5 pinned exact.
02 · Vocabulary lint · tests 12 · Product names are word-bounded so the run modes express/sketch and the envelope field next do not trip the lint; clean-room words match as substrings.
03 · Result envelope and brief header contracts · tests 24 · SeatName, Severity and ConfigError are defined once in contracts/header.ts; config/schema.ts, config/load.ts and registry/gates.ts will re-export them.
