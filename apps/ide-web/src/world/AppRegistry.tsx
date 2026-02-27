import { ROUTES } from "./routes";

export type AppKind = "route" | "iframe" | "external";

export interface WorldApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  kind: AppKind;
  path?: string;
  url?: string;
  group?: "core" | "lab" | "tools" | "external";
}

export type ViewableWorldApp = WorldApp & (
  | { kind: "route"; path: string }
  | { kind: "iframe"; url: string }
);

export const WORLD_APPS: WorldApp[] = [
  {
    id: "launcher",
    name: "Launcher",
    description: "All apps in one place.",
    icon: "⌂",
    kind: "route",
    path: ROUTES.root,
    group: "core",
  },
  {
    id: "neon-hub",
    name: "Neon Hub",
    description: "Theme showcase + portal UI.",
    icon: "✦",
    kind: "route",
    path: ROUTES.hub,
    group: "core",
  },
  {
    id: "launcher-control",
    name: "System Launcher",
    description: "Master launch & service control.",
    icon: "⚡",
    kind: "route",
    path: ROUTES.lab.launcherControl,
    group: "core",
  },

  // Lab Apps (internal)
  {
    id: "lab-studio",
    name: "Studio Lab",
    description: "Ontology IDE + World Engine Studio.",
    icon: "⚙",
    kind: "route",
    path: ROUTES.lab.studio,
    group: "lab",
  },
  {
    id: "lab-nucleus",
    name: "Nucleus Monitor",
    description: "Event monitor + quick dispatch.",
    icon: "⚑",
    kind: "route",
    path: ROUTES.lab.nucleus,
    group: "lab",
  },
  {
    id: "lab-brain",
    name: "Brain Console",
    description: "Query console + scoring + history.",
    icon: "🧠",
    kind: "route",
    path: ROUTES.lab.brain,
    group: "lab",
  },
  {
    id: "lab-lexicon",
    name: "Lexicon Inspector",
    description: "Token vault + ingest + search.",
    icon: "⧉",
    kind: "route",
    path: ROUTES.lab.lexicon,
    group: "lab",
  },
  {
    id: "lab-leximorph",
    name: "Leximorph Lab",
    description: "Word/code morphology search, review queue, and ingest controls.",
    icon: "ðŸ”¬",
    kind: "route",
    path: ROUTES.lab.leximorph,
    group: "lab",
  },
  {
    id: "lab-chat",
    name: "Chat Console",
    description: "AI communication + streaming.",
    icon: "💬",
    kind: "route",
    path: ROUTES.lab.chat,
    group: "lab",
  },
  {
    id: "lab-game-engine",
    name: "Game Engine",
    description: "Environment + simulation control.",
    icon: "🎮",
    kind: "route",
    path: ROUTES.lab.gameEngine,
    group: "lab",
  },
  {
    id: "lab-game-studio",
    name: "Game Studio",
    description: "Real-time 3D viewer with WebSocket control.",
    icon: "🎬",
    kind: "route",
    path: ROUTES.lab.gameStudio,
    group: "lab",
  },
  {
    id: "lab-prefab-engine",
    name: "Prefab Engine",
    description: "Generate LEGO-style prefabs and launch to game environment.",
    icon: "🧱",
    kind: "route",
    path: ROUTES.lab.prefabEngine,
    group: "lab",
  },
  {
    id: "lab-graphics",
    name: "Graphics Pipeline",
    description: "Rendering + shader compilation.",
    icon: "🎨",
    kind: "route",
    path: ROUTES.lab.graphics,
    group: "lab",
  },
  {
    id: "lab-terrain-erosion",
    name: "Terrain Erosion",
    description: "Particle hydraulic erosion simulation.",
    icon: "🏔️",
    kind: "route",
    path: ROUTES.lab.terrainErosion,
    group: "lab",
  },
  {
    id: "lab-wfc",
    name: "Wave Function Collapse",
    description: "Constraint satisfaction for procedural generation.",
    icon: "🌊",
    kind: "route",
    path: ROUTES.lab.wfc,
    group: "lab",
  },
  {
    id: "lab-ecs-architecture",
    name: "ECS Architecture",
    description: "Compare Archetype vs Sparse Set implementations.",
    icon: "🧩",
    kind: "route",
    path: ROUTES.lab.ecsArchitecture,
    group: "lab",
  },
  {
    id: "lab-memory-allocators",
    name: "Memory Allocators",
    description: "Visualize Linear, Stack, and Pool allocators.",
    icon: "💾",
    kind: "route",
    path: ROUTES.lab.memoryAllocators,
    group: "lab",
  },
  {
    id: "lab-world-engine-blueprint",
    name: "World Engine Blueprint",
    description:
      "Complete architecture reference: ECS, Render Graph, Quaternions, Origin Rebasing, Erosion.",
    icon: "🏗️",
    kind: "route",
    path: ROUTES.lab.worldEngineBlueprint,
    group: "lab",
  },
  {
    id: "lab-math-engine",
    name: "Math Engine",
    description: "Environmental math utilities: Unit Circle, Particle System, Physics Simulation.",
    icon: "📐",
    kind: "route",
    path: ROUTES.lab.mathEngine,
    group: "lab",
  },
  {
    id: "lab-world-graph",
    name: "World Graph",
    description: "Pattern graph + DSL world simulation panel.",
    icon: "🕸",
    kind: "route",
    path: ROUTES.lab.worldGraph,
    group: "lab",
  },
  {
    id: "nexus-pipeline",
    name: "Nexus Pipeline",
    description: "Data flow + orchestration.",
    icon: "⚡",
    kind: "route",
    path: ROUTES.lab.nexus,
    group: "lab",
  },
  {
    id: "pipeline-results",
    name: "Pipeline Results",
    description: "Evidence + decision + plan viewer.",
    icon: "📊",
    kind: "route",
    path: ROUTES.lab.pipelineResults,
    group: "lab",
  },
  {
    id: "avatar-build",
    name: "Avatar Compiler (V2)",
    description: "Deterministic avatar compilation via Nucleus API.",
    icon: "🧬",
    kind: "route",
    path: ROUTES.lab.avatarCompiler,
    group: "tools",
  },
  {
    id: "lab-heart-timeline",
    name: "Heart Timeline",
    description: "Deterministic axis-codex timeline simulator and replay lab.",
    icon: "♡",
    kind: "route",
    path: ROUTES.lab.heartTimeline,
    group: "lab",
  },

  {
    id: "avatar-sandbox",
    name: "Avatar Sandbox",
    description: "WEGC v1.0 - Interactive avatar creator with GLB export.",
    icon: "🧑",
    kind: "iframe",
    url: "http://localhost:5174",
    group: "tools",
  },

  // Tools
  {
    id: "docs",
    name: "Docs",
    description: "Open docs in a new tab.",
    icon: "📘",
    kind: "external",
    url: "https://github.com",
    group: "external",
  },
];

export function getAppById(id: string) {
  return WORLD_APPS.find((a) => a.id === id) ?? null;
}

export function getRoutableApps() {
  return WORLD_APPS.filter((a) => a.kind === "route" && a.path);
}

export function getIframeApps() {
  return WORLD_APPS.filter((a) => a.kind === "iframe" && a.url);
}

export function getViewableApps(): ViewableWorldApp[] {
  return WORLD_APPS.filter(
    (a): a is ViewableWorldApp =>
      (a.kind === "route" && typeof a.path === "string" && a.path.length > 0) ||
      (a.kind === "iframe" && typeof a.url === "string" && a.url.length > 0),
  );
}
