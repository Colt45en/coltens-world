# World Engine Architecture Specification

## Overview

World Engine is a full-featured IDE + runtime for building deterministic, multiplayer-ready game worlds with an AI-assist brain grounded in a code lexicon.

### Related Specs

- [Mathematical Foundations (R3F)](./MATHEMATICAL_FOUNDATIONS_R3F.md)
- [R3F Ecosystem Architectural Analysis](./R3F_ECOSYSTEM_ARCHITECTURAL_ANALYSIS.md)
- [R3F Implementation Checklist](./R3F_IMPLEMENTATION_CHECKLIST.md)
- [Avatar V1 Blueprint Upgrade](./AVATAR_V1_BLUEPRINT_UPGRADE.md)
- [Avatar V1.1 Blueprint Upgrade](./AVATAR_V1_1_BLUEPRINT_UPGRADE.md)
- [Avatar V1.2 Blueprint Upgrade](./AVATAR_V1_2_BLUEPRINT_UPGRADE.md)

### Key Components

1. **IDE Web (Vite)** - Editor, panels, preview windows
2. **Nucleus (Node)** - WebSocket orchestrator, file watcher, build runner
3. **Python Sidecar** - Math engine, lexicon indexing, AI tools
4. **Preview Runtime (Iframe)** - ECS engine, renderer, asset loader

## Protocol

All communication uses typed message envelopes with:

- UUID message ID
- Timestamp
- Sender role and instance
- Session ID
- Optional trace/auth
- Validated payload (Zod)

See `packages/protocol` for complete message contracts.

## Bus Channels

- `system` - Lifecycle, sessions, permissions
- `files` - Watch events, read/write
- `build` - Build start/logs/done
- `runtime` - Tick, snapshot, control
- `graphics` - Commands, stats
- `lexicon` - Query, upsert
- `math` - Eval, symbolic
- `ai` - Agent requests, approvals

## Data Flow

### Build Pipeline

1. IDE saves file → Nucleus watches
2. Nucleus triggers build
3. Build produces bundle hash + modules
4. Preview iframe receives hot-reload signal
5. Modules updated in runtime

### Runtime Loop

1. Preview animates at 60 FPS
2. ECS engine ticks
3. Snapshot sent to IDE (sampled)
4. Graphics stats tracked
5. Inspector syncs entity tree

### Lexicon Query

1. IDE/Brain queries lexicon
2. Sidecar searches in-memory or SQLite
3. Returns entries with constraints, examples, links
4. Brain uses to safely invoke APIs

## File Organization

```txt
packages/
  protocol/     - Zod schemas, envelopes
  bus/          - Event bus, channels, router
  engine/       - ECS, determinism
  graphics/     - Renderer bridge
  assets/       - Loader, manifest
  math/         - Vectors, RNG, stats
  lexicon/      - Database, query
  tooling/      - Build helpers

apps/
  ide-web/      - Vite, Monaco, panels
  nucleus/      - Node, WS hub, routes
  py-sidecar/   - FastAPI, math, lexicon
  preview-runtime/ - Iframe, engine, renderer
```

## Security Baseline

- Iframes use `sandbox="allow-scripts"`
- All messages include sessionId + nonce
- Server enforces capability-based access control
- Python sidecar is stateless (keyed by sessionId)
- No direct cross-iframe communication

## MVP Checklist

- [ ] Protocol package with 10+ message types
- [ ] LocalBus with subscribe/publish/request-response
- [ ] ECSEngine with systems and snapshots
- [ ] Nucleus WebSocket hub
- [ ] IDE Web basic layout
- [ ] Preview runtime connection
- [ ] Lexicon in-memory DB
- [ ] Math catalog (basic vectors + RNG)
- [ ] Python sidecar FastAPI stub
- [ ] Hot reload wiring
- [ ] Inspector panel (entity tree)
- [ ] Lexicon browser panel
- [ ] Brain panel with approvals
