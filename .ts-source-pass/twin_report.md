# TS-as-source twin report

Root: ``

## Summary
- Code files: **465**
- Twin pairs: **134**
- Import rewrite suggestions: **27**
- Delete candidates (JS, confidence>=0.70): **76**
- Unresolved relative imports (first 500 listed): **0**

## Ranked twins

| Rank | Base | Winner | Conf | TS importers | JS importers | TS entries | JS entries | Similarity | Reasoning |
|---:|---|---|---:|---:|---:|---:|---:|---|---|
| 1 | `apps/env-sandbox/src/types` | **ts** | 0.80 | 4 | 3 | 0 | 0 | 0.76 | TS has more importers (4 vs 3); High textual similarity (76%) |
| 2 | `apps/nucleus/src/ndjson` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.79 | TS has more importers (2 vs 0); High textual similarity (79%) |
| 3 | `apps/nucleus/src/router/handlers/ideCli` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.84 | TS has more importers (2 vs 0); High textual similarity (84%) |
| 4 | `apps/nucleus/src/router/handlers/ideFs` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.78 | TS has more importers (2 vs 0); High textual similarity (78%) |
| 5 | `apps/nucleus/src/routes/busReplay` | **ts** | 0.80 | 4 | 0 | 0 | 0 | 0.96 | TS has more importers (4 vs 0); High textual similarity (96%) |
| 6 | `apps/nucleus/src/routes/http/flowstate` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.85 | TS has more importers (2 vs 0); High textual similarity (85%) |
| 7 | `apps/nucleus/src/routes/http/leximorph` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.86 | TS has more importers (2 vs 0); High textual similarity (86%) |
| 8 | `apps/nucleus/src/routes/http/pipelineResults` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.78 | TS has more importers (2 vs 0); High textual similarity (78%) |
| 9 | `apps/nucleus/src/routes/operatorEvent` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.80 | TS has more importers (2 vs 0); High textual similarity (80%) |
| 10 | `apps/nucleus/src/tool/executor` | **ts** | 0.80 | 3 | 0 | 0 | 0 | 0.71 | TS has more importers (3 vs 0); High textual similarity (71%) |
| 11 | `packages/engine/src/contracts/lexicon/prompt-operators/optimizePrompt.schema` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.92 | TS has more importers (2 vs 0); High textual similarity (92%) |
| 12 | `packages/engine/src/contracts/multigpu/deps` | **ts** | 0.80 | 4 | 0 | 0 | 0 | 0.80 | TS has more importers (4 vs 0); High textual similarity (80%) |
| 13 | `packages/engine/src/contracts/multigpu/pacing` | **ts** | 0.80 | 4 | 0 | 0 | 0 | 0.88 | TS has more importers (4 vs 0); High textual similarity (88%) |
| 14 | `packages/engine/src/contracts/multigpu/plan` | **ts** | 0.80 | 3 | 0 | 0 | 0 | 0.95 | TS has more importers (3 vs 0); High textual similarity (95%) |
| 15 | `packages/engine/src/contracts/multigpu/sync` | **ts** | 0.80 | 4 | 0 | 0 | 0 | 0.70 | TS has more importers (4 vs 0); High textual similarity (70%) |
| 16 | `packages/engine/src/contracts/multigpu/work` | **ts** | 0.80 | 6 | 0 | 0 | 0 | 0.77 | TS has more importers (6 vs 0); High textual similarity (77%) |
| 17 | `packages/engine/src/contracts/protocol/envelope` | **ts** | 0.80 | 6 | 0 | 0 | 0 | 0.88 | TS has more importers (6 vs 0); High textual similarity (88%) |
| 18 | `packages/engine/src/contracts/protocol/sim` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.81 | TS has more importers (2 vs 0); High textual similarity (81%) |
| 19 | `packages/engine/src/contracts/representation/gates` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.78 | TS has more importers (2 vs 0); High textual similarity (78%) |
| 20 | `packages/flowstate/src/core/metrics` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.77 | TS has more importers (2 vs 0); High textual similarity (77%) |
| 21 | `packages/flowstate/src/core/seed` | **ts** | 0.80 | 4 | 0 | 0 | 0 | 0.90 | TS has more importers (4 vs 0); High textual similarity (90%) |
| 22 | `packages/flowstate/src/evidence/canonicalJson` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.80 | TS has more importers (2 vs 0); High textual similarity (80%) |
| 23 | `packages/flowstate/src/evidence/crypto` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.73 | TS has more importers (2 vs 0); High textual similarity (73%) |
| 24 | `packages/flowstate/src/evidence/download` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.84 | TS has more importers (2 vs 0); High textual similarity (84%) |
| 25 | `packages/flowstate/src/evidence/session` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.85 | TS has more importers (2 vs 0); High textual similarity (85%) |
| 26 | `packages/flowstate/src/render/heatmapRenderer` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.77 | TS has more importers (2 vs 0); High textual similarity (77%) |
| 27 | `packages/flowstate/src/render/histogramRenderer` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.81 | TS has more importers (2 vs 0); High textual similarity (81%) |
| 28 | `packages/flowstate/src/render/orbitRenderer` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.80 | TS has more importers (2 vs 0); High textual similarity (80%) |
| 29 | `packages/flowstate/src/render/ringRenderer` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.81 | TS has more importers (2 vs 0); High textual similarity (81%) |
| 30 | `packages/protocol/src/buildEvidence` | **ts** | 0.80 | 4 | 2 | 0 | 0 | 0.97 | TS has more importers (4 vs 2); High textual similarity (97%) |
| 31 | `packages/protocol/src/capabilities` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.70 | TS has more importers (2 vs 0); High textual similarity (70%) |
| 32 | `packages/protocol/src/chat` | **ts** | 0.80 | 3 | 0 | 0 | 0 | 0.77 | TS has more importers (3 vs 0); High textual similarity (77%) |
| 33 | `packages/protocol/src/contracts/evidence` | **ts** | 0.80 | 1 | 0 | 0 | 0 | 0.82 | TS has more importers (1 vs 0); High textual similarity (82%) |
| 34 | `packages/protocol/src/contracts/flowstate` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.84 | TS has more importers (2 vs 0); High textual similarity (84%) |
| 35 | `packages/protocol/src/contracts/worldGraph` | **ts** | 0.80 | 3 | 0 | 0 | 0 | 0.72 | TS has more importers (3 vs 0); High textual similarity (72%) |
| 36 | `packages/protocol/src/ide` | **ts** | 0.80 | 3 | 0 | 0 | 0 | 0.89 | TS has more importers (3 vs 0); High textual similarity (89%) |
| 37 | `packages/protocol/src/operator` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.89 | TS has more importers (2 vs 0); High textual similarity (89%) |
| 38 | `packages/protocol/src/representation` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.92 | TS has more importers (2 vs 0); High textual similarity (92%) |
| 39 | `packages/protocol/src/schemas` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.97 | TS has more importers (2 vs 0); High textual similarity (97%) |
| 40 | `packages/protocol/src/system/health` | **ts** | 0.80 | 2 | 0 | 0 | 0 | 0.83 | TS has more importers (2 vs 0); High textual similarity (83%) |
| 41 | `packages/tooling/src/compilers/csCompiler` | **ts** | 0.80 | 3 | 0 | 0 | 0 | 0.78 | TS has more importers (3 vs 0); High textual similarity (78%) |
| 42 | `packages/tooling/src/compilers/jsCompiler` | **ts** | 0.80 | 3 | 0 | 0 | 0 | 0.73 | TS has more importers (3 vs 0); High textual similarity (73%) |
| 43 | `packages/util/src/time` | **ts** | 0.80 | 3 | 0 | 0 | 0 | 0.87 | TS has more importers (3 vs 0); High textual similarity (87%) |
| 44 | `apps/nucleus/src/bus/busHub` | **ts** | 0.75 | 8 | 0 | 0 | 0 | 0.67 | TS has more importers (8 vs 0); Low similarity (67%) |
| 45 | `apps/nucleus/src/bus/publish` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.48 | TS has more importers (2 vs 0); Low similarity (48%) |
| 46 | `apps/nucleus/src/health/poller` | **ts** | 0.75 | 2 | 1 | 0 | 0 | 0.55 | TS has more importers (2 vs 1); Low similarity (55%) |
| 47 | `apps/nucleus/src/pty/ptySession` | **ts** | 0.75 | 1 | 0 | 0 | 0 | 0.00 | TS has more importers (1 vs 0); Low similarity (0%) |
| 48 | `apps/nucleus/src/pty/venoManager` | **ts** | 0.75 | 4 | 0 | 0 | 0 | 0.69 | TS has more importers (4 vs 0); Low similarity (69%) |
| 49 | `apps/nucleus/src/router/uee` | **ts** | 0.75 | 5 | 2 | 0 | 0 | 0.64 | TS has more importers (5 vs 2); Low similarity (64%) |
| 50 | `apps/nucleus/src/routes/health` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.58 | TS has more importers (2 vs 0); Low similarity (58%) |
| 51 | `apps/nucleus/src/routes/wsBus` | **ts** | 0.75 | 4 | 0 | 0 | 0 | 0.60 | TS has more importers (4 vs 0); Low similarity (60%) |
| 52 | `apps/nucleus/src/services/compilerEvidence` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.64 | TS has more importers (2 vs 0); Low similarity (64%) |
| 53 | `apps/nucleus/src/services/simRunner` | **ts** | 0.75 | 4 | 0 | 0 | 0 | 0.69 | TS has more importers (4 vs 0); Low similarity (69%) |
| 54 | `apps/nucleus/src/sessionStore` | **ts** | 0.75 | 1 | 0 | 0 | 0 | 0.68 | TS has more importers (1 vs 0); Low similarity (68%) |
| 55 | `apps/nucleus/src/tool/types` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.17 | TS has more importers (2 vs 0); Low similarity (17%) |
| 56 | `apps/nucleus/src/wsHub` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.69 | TS has more importers (2 vs 0); Low similarity (69%) |
| 57 | `packages/engine/src/collision` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.63 | TS has more importers (2 vs 0); Low similarity (63%) |
| 58 | `packages/engine/src/contracts/multigpu/primitives` | **ts** | 0.75 | 12 | 0 | 0 | 0 | 0.69 | TS has more importers (12 vs 0); Low similarity (69%) |
| 59 | `packages/engine/src/contracts/protocol/ops` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.59 | TS has more importers (2 vs 0); Low similarity (59%) |
| 60 | `packages/engine/src/index` | **ts** | 0.75 | 1 | 0 | 0 | 0 | 0.65 | TS has more importers (1 vs 0); Low similarity (65%) |
| 61 | `packages/engine/src/learning/xor-trainer` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.61 | TS has more importers (2 vs 0); Low similarity (61%) |
| 62 | `packages/flowstate/src/core/braceBalance` | **ts** | 0.75 | 4 | 0 | 0 | 0 | 0.64 | TS has more importers (4 vs 0); Low similarity (64%) |
| 63 | `packages/flowstate/src/core/tokenize` | **ts** | 0.75 | 4 | 0 | 0 | 0 | 0.40 | TS has more importers (4 vs 0); Low similarity (40%) |
| 64 | `packages/flowstate/src/index` | **ts** | 0.75 | 1 | 0 | 0 | 0 | 0.50 | TS has more importers (1 vs 0); Low similarity (50%) |
| 65 | `packages/flowstate/src/render/canvasFit` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.68 | TS has more importers (2 vs 0); Low similarity (68%) |
| 66 | `packages/flowstate/src/render/types` | **ts** | 0.75 | 6 | 0 | 0 | 0 | 0.13 | TS has more importers (6 vs 0); Low similarity (13%) |
| 67 | `packages/protocol/src/envelopes` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.10 | TS has more importers (2 vs 0); Low similarity (10%) |
| 68 | `packages/protocol/src/idle` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.70 | TS has more importers (2 vs 0); Low similarity (70%) |
| 69 | `packages/protocol/src/types` | **ts** | 0.75 | 4 | 0 | 0 | 0 | 0.03 | TS has more importers (4 vs 0); Low similarity (3%) |
| 70 | `packages/protocol/src/uee` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.58 | TS has more importers (2 vs 0); Low similarity (58%) |
| 71 | `packages/tooling/src/compilers/helpers` | **ts** | 0.75 | 5 | 0 | 0 | 0 | 0.45 | TS has more importers (5 vs 0); Low similarity (45%) |
| 72 | `packages/tooling/src/compilers/types` | **ts** | 0.75 | 5 | 0 | 0 | 0 | 0.00 | TS has more importers (5 vs 0); Low similarity (0%) |
| 73 | `packages/tooling/src/utils-node` | **ts** | 0.75 | 2 | 0 | 0 | 0 | 0.59 | TS has more importers (2 vs 0); Low similarity (59%) |
| 74 | `packages/util/src/fileUtils` | **ts** | 0.75 | 5 | 0 | 0 | 0 | 0.67 | TS has more importers (5 vs 0); Low similarity (67%) |
| 75 | `packages/util/src/hash` | **ts** | 0.75 | 3 | 0 | 0 | 0 | 0.69 | TS has more importers (3 vs 0); Low similarity (69%) |
| 76 | `packages/util/src/packageName` | **ts** | 0.75 | 3 | 0 | 0 | 0 | 0.67 | TS has more importers (3 vs 0); Low similarity (67%) |
| 77 | `apps/env-sandbox/src/contracts` | **ts** | 0.60 | 3 | 3 | 0 | 0 | 0.77 | Equal importers (3); High textual similarity (77%) |
| 78 | `apps/nucleus/src/idle` | **ts** | 0.60 | 1 | 1 | 0 | 0 | 0.71 | Equal importers (1); High textual similarity (71%) |
| 79 | `apps/nucleus/src/router/handlers/brainControl` | **ts** | 0.60 | 1 | 1 | 0 | 0 | 0.76 | Equal importers (1); High textual similarity (76%) |
| 80 | `apps/nucleus/src/router/handlers/brainTrain` | **ts** | 0.60 | 1 | 1 | 0 | 0 | 0.85 | Equal importers (1); High textual similarity (85%) |
| 81 | `apps/nucleus/src/routes/chat` | **ts** | 0.60 | 1 | 1 | 0 | 0 | 0.79 | Equal importers (1); High textual similarity (79%) |
| 82 | `packages/brain/src/review/reviewTypes` | **ts** | 0.60 | 2 | 2 | 0 | 0 | 0.89 | Equal importers (2); High textual similarity (89%) |
| 83 | `apps/env-sandbox/src/audit` | **ts** | 0.55 | 2 | 2 | 0 | 0 | 0.36 | Equal importers (2); Low similarity (36%) |
| 84 | `apps/env-sandbox/src/policy` | **ts** | 0.55 | 1 | 1 | 0 | 0 | 0.60 | Equal importers (1); Low similarity (60%) |
| 85 | `apps/env-sandbox/src/sandbox` | **ts** | 0.55 | 1 | 1 | 0 | 0 | 0.65 | Equal importers (1); Low similarity (65%) |
| 86 | `apps/env-sandbox/src/sandbox-tools` | **ts** | 0.55 | 1 | 1 | 0 | 0 | 0.51 | Equal importers (1); Low similarity (51%) |
| 87 | `apps/env-sandbox/src/storage` | **ts** | 0.55 | 3 | 3 | 0 | 0 | 0.65 | Equal importers (3); Low similarity (65%) |
| 88 | `apps/nucleus/src/chat-handler` | **ts** | 0.55 | 1 | 1 | 0 | 0 | 0.66 | Equal importers (1); Low similarity (66%) |
| 89 | `apps/nucleus/src/health/adapter` | **ts** | 0.55 | 1 | 1 | 0 | 0 | 0.63 | Equal importers (1); Low similarity (63%) |
| 90 | `apps/env-sandbox/src/demo` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.86 | No importers detected (dead/entry-only/or dynamic); High textual similarity (86%) |
| 91 | `apps/env-sandbox/src/index` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.79 | No importers detected (dead/entry-only/or dynamic); High textual similarity (79%) |
| 92 | `apps/ide-web/tailwind.config` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.33 | No importers detected (dead/entry-only/or dynamic); Low similarity (33%) |
| 93 | `apps/nucleus/src/bus-ws-bridge` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.69 | No importers detected (dead/entry-only/or dynamic); Low similarity (69%) |
| 94 | `apps/nucleus/src/bus/handlers/buildEvidence` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.67 | No importers detected (dead/entry-only/or dynamic); Low similarity (67%) |
| 95 | `apps/nucleus/src/index` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.81 | No importers detected (dead/entry-only/or dynamic); High textual similarity (81%) |
| 96 | `apps/nucleus/src/router/handlers/base` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.55 | No importers detected (dead/entry-only/or dynamic); Low similarity (55%) |
| 97 | `apps/nucleus/src/router/handlers/index` | **ts** | 0.35 | 0 | 0 | 0 | 0 | hash=1.00 | No importers detected (dead/entry-only/or dynamic); Exact content hash match |
| 98 | `apps/nucleus/src/routes/buildEvidence` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.97 | No importers detected (dead/entry-only/or dynamic); High textual similarity (97%) |
| 99 | `apps/nucleus/src/routes/lexicon` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.88 | No importers detected (dead/entry-only/or dynamic); High textual similarity (88%) |
| 100 | `apps/nucleus/src/routes/lexicon-disabled` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.90 | No importers detected (dead/entry-only/or dynamic); High textual similarity (90%) |
| 101 | `apps/nucleus/src/routes/routes` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 1.00 | No importers detected (dead/entry-only/or dynamic); High textual similarity (100%) |
| 102 | `apps/nucleus/src/simulation` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.90 | No importers detected (dead/entry-only/or dynamic); High textual similarity (90%) |
| 103 | `apps/nucleus/src/unified-runner-integration` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.89 | No importers detected (dead/entry-only/or dynamic); High textual similarity (89%) |
| 104 | `apps/nucleus/src/wsHub_new` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.63 | No importers detected (dead/entry-only/or dynamic); Low similarity (63%) |
| 105 | `packages/brain/src/index` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.75 | No importers detected (dead/entry-only/or dynamic); High textual similarity (75%) |
| 106 | `packages/math/src/index` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.64 | No importers detected (dead/entry-only/or dynamic); Low similarity (64%) |
| 107 | `packages/protocol/src/envelopes/index` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 1.00 | No importers detected (dead/entry-only/or dynamic); High textual similarity (100%) |
| 108 | `packages/protocol/src/index` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.80 | No importers detected (dead/entry-only/or dynamic); High textual similarity (80%) |
| 109 | `packages/tooling/src/index` | **ts** | 0.35 | 0 | 0 | 0 | 0 | hash=1.00 | No importers detected (dead/entry-only/or dynamic); Exact content hash match |
| 110 | `packages/util/src/index` | **ts** | 0.35 | 0 | 0 | 0 | 0 | hash=1.00 | No importers detected (dead/entry-only/or dynamic); Exact content hash match |
| 111 | `world-engine-chat/nucleus/src/server` | **ts** | 0.35 | 0 | 0 | 0 | 0 | 0.76 | No importers detected (dead/entry-only/or dynamic); High textual similarity (76%) |
| 112 | `packages/engine/src/contracts/multigpu/index` | **js** | 0.90 | 0 | 2 | 0 | 0 | hash=1.00 | JS has more importers (2 vs 0); Exact content hash match |
| 113 | `packages/engine/src/contracts/protocol/index` | **js** | 0.90 | 0 | 2 | 0 | 0 | hash=1.00 | JS has more importers (2 vs 0); Exact content hash match |
| 114 | `packages/engine/src/contracts/representation/index` | **js** | 0.90 | 0 | 2 | 0 | 0 | hash=1.00 | JS has more importers (2 vs 0); Exact content hash match |
| 115 | `packages/engine/src/learning/index` | **js** | 0.90 | 0 | 2 | 0 | 0 | hash=1.00 | JS has more importers (2 vs 0); Exact content hash match |
| 116 | `packages/brain/src/controller` | **js** | 0.75 | 0 | 2 | 0 | 0 | 0.65 | JS has more importers (2 vs 0); Low similarity (65%) |
| 117 | `packages/brain/src/population` | **js** | 0.75 | 0 | 2 | 0 | 0 | 0.67 | JS has more importers (2 vs 0); Low similarity (67%) |
| 118 | `packages/brain/src/review/reviewStore` | **js** | 0.75 | 1 | 2 | 0 | 0 | 0.67 | JS has more importers (2 vs 1); Low similarity (67%) |
| 119 | `packages/engine/src/contracts/envelopeFactory` | **js** | 0.75 | 0 | 2 | 0 | 0 | 0.69 | JS has more importers (2 vs 0); Low similarity (69%) |
| 120 | `packages/engine/src/contracts/index` | **js** | 0.75 | 0 | 2 | 0 | 0 | 0.35 | JS has more importers (2 vs 0); Low similarity (35%) |
| 121 | `packages/engine/src/contracts/lexicon/index` | **js** | 0.75 | 0 | 2 | 0 | 0 | 0.33 | JS has more importers (2 vs 0); Low similarity (33%) |
| 122 | `packages/engine/src/contracts/lexicon/promptOperatorRegistry` | **js** | 0.75 | 1 | 2 | 0 | 0 | 0.50 | JS has more importers (2 vs 1); Low similarity (50%) |
| 123 | `packages/engine/src/contracts/util/require-schema` | **js** | 0.75 | 0 | 2 | 0 | 0 | 0.70 | JS has more importers (2 vs 0); Low similarity (70%) |
| 124 | `packages/engine/src/prediction` | **js** | 0.75 | 0 | 2 | 0 | 0 | 0.66 | JS has more importers (2 vs 0); Low similarity (66%) |
| 125 | `packages/engine/src/runtime/json` | **js** | 0.75 | 0 | 2 | 0 | 0 | 0.69 | JS has more importers (2 vs 0); Low similarity (69%) |
| 126 | `packages/protocol/src/envelopes/uee/guards` | **js** | 0.75 | 0 | 2 | 0 | 0 | 0.60 | JS has more importers (2 vs 0); Low similarity (60%) |
| 127 | `world-engine-chat/nucleus/src/contracts` | **js** | 0.75 | 0 | 1 | 0 | 0 | 0.54 | JS has more importers (1 vs 0); Low similarity (54%) |
| 128 | `packages/brain/src/network` | **js** | 0.70 | 0 | 5 | 0 | 0 | 0.85 | JS has more importers (5 vs 0); High textual similarity (85%) |
| 129 | `packages/engine/src/contracts/busEnvelope` | **js** | 0.70 | 1 | 2 | 0 | 0 | 0.89 | JS has more importers (2 vs 1); High textual similarity (89%) |
| 130 | `packages/engine/src/contracts/lexicon/LexiconEntry.schema` | **js** | 0.70 | 0 | 3 | 0 | 0 | 0.94 | JS has more importers (3 vs 0); High textual similarity (94%) |
| 131 | `packages/engine/src/contracts/util/exhaustive` | **js** | 0.70 | 0 | 2 | 0 | 0 | 0.79 | JS has more importers (2 vs 0); High textual similarity (79%) |
| 132 | `packages/protocol/src/bus/buildEvidenceBus` | **js** | 0.70 | 0 | 2 | 0 | 0 | 0.72 | JS has more importers (2 vs 0); High textual similarity (72%) |
| 133 | `packages/protocol/src/envelopes/uee/index` | **js** | 0.70 | 0 | 2 | 0 | 0 | 1.00 | JS has more importers (2 vs 0); High textual similarity (100%) |
| 134 | `packages/protocol/src/envelopes/uee/schema` | **js** | 0.70 | 0 | 4 | 0 | 0 | 0.91 | JS has more importers (4 vs 0); High textual similarity (91%) |
