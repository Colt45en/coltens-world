# coltens-world

Deterministic contract-first message-driven world engine monorepo.

## What's inside

| Package | Description |
|---|---|
| `packages/bus` | Central `MessageBus` – synchronous pub/sub with a full replay log |
| `packages/world-engine` | ECS `WorldEngine` – entities, components, systems, fixed-step tick loop |
| `packages/brain-nucleus` | `BrainNucleus` + `Brain` – sense → plan → act agent AI |
| `packages/agent-tools` | `AgentToolRegistry` – LLM-style tool-call interface for agents |
| `packages/code-editor` | `CodeEditor` – in-browser JS editor with syntax highlight and sandboxed run |
| `packages/graphics-pipeline` | `GraphicsPipeline` – layered Canvas 2D renderer (shapes, text, sprites) |
| `packages/avatar-creator` | `AvatarCreator` – procedural avatar builder with part/colour customisation |
| `packages/prefab-creator` | `PrefabRegistry` + `PrefabCreator` – blueprint/template system with inheritance |
| `app/` | Main application entry-point that ties every module together |
| `index.html` | Browser entry-point – tabbed game environment UI |

## Architecture

```
MessageBus (deterministic pub/sub)
    ├── WorldEngine  (ECS + physics system)
    │       └─ ticks → BrainNucleus agents (sense/plan/act)
    ├── GraphicsPipeline (renders world state each tick)
    └── AgentToolRegistry (tool calls: snapshot, spawn, despawn, get/set component)

Browser UI tabs
    🎮 Game          – live Canvas game world + HUD + bus log
    📝 Code Editor   – live JS editor with world/bus/tools/prefabs in scope
    🔧 Agent Tools   – tool manifest browser + interactive tool-call REPL
    🎨 Graphics      – GraphicsPipeline primitives demo
    🧍 Avatar        – part/colour avatar builder with JSON export
    📦 Prefabs       – blueprint editor with inheritance + instantiation
```

## Quick start

```sh
# Serve the project (no build step required – plain ES modules)
npx serve . -p 3000
# then open http://localhost:3000

# Run tests
npm test
```

## Tests

52 unit tests across 5 packages (MessageBus, WorldEngine, BrainNucleus,
AgentTools, PrefabCreator). Run with `npm test`.
