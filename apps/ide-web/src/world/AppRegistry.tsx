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
    id: "lab-math-workspace",
    name: "Math Workspace",
    description: "Interactive 3D math workspace with analytic and mesh validation.",
    icon: "🧮",
    kind: "route",
    path: ROUTES.lab.mathWorkspace,
    group: "lab",
  },
  {
    id: "lab-math-dependency-graph",
    name: "Math Dependency Graph",
    description: "Visual graph of math engine dependencies and relationships.",
    icon: "🕸️",
    kind: "route",
    path: ROUTES.lab.mathDependencyGraph,
    group: "lab",
  },
  {
    id: "lab-complex-playground",
    name: "Complex Playground",
    description: "Complex-number experimentation and interactive visualization tools.",
    icon: "🌀",
    kind: "route",
    path: ROUTES.lab.complexPlayground,
    group: "lab",
  },
  {
    id: "lab-matrix-playground",
    name: "Matrix Playground",
    description: "Matrix operations and transformations playground.",
    icon: "🔢",
    kind: "route",
    path: ROUTES.lab.matrixPlayground,
    group: "lab",
  },
  {
    id: "lab-svg-rendering",
    name: "SVG Rendering",
    description: "SVG rendering and geometry visualization lab.",
    icon: "🖼️",
    kind: "route",
    path: ROUTES.lab.svgRendering,
    group: "lab",
  },
  {
    id: "lab-3d-mathematics",
    name: "3D Mathematics",
    description: "3D math scene exploration and transformation demos.",
    icon: "📦",
    kind: "route",
    path: ROUTES.lab.math3D,
    group: "lab",
  },
  {
    id: "lab-physics",
    name: "Physics Lab",
    description: "Physics simulation playground and controls.",
    icon: "⚛️",
    kind: "route",
    path: ROUTES.lab.physics,
    group: "lab",
  },
  {
    id: "lab-vector-physics",
    name: "Vector Physics",
    description: "Vector-based physics simulations and visual diagnostics.",
    icon: "🏹",
    kind: "route",
    path: ROUTES.lab.vectorPhysics,
    group: "lab",
  },
  {
    id: "lab-icon-generator",
    name: "Icon Generator",
    description: "Generate icon variants with rendering controls.",
    icon: "🎯",
    kind: "route",
    path: ROUTES.lab.iconGenerator,
    group: "lab",
  },
  {
    id: "lab-agent-chat",
    name: "Agent Chat",
    description: "Agent chat UI for prompt workflows and diagnostics.",
    icon: "🤖",
    kind: "route",
    path: ROUTES.lab.agentChat,
    group: "lab",
  },
  {
    id: "lab-graphics-generator",
    name: "Graphics Generator",
    description: "Real-time graphics generator and animation controls.",
    icon: "🧪",
    kind: "route",
    path: ROUTES.lab.graphicsGenerator,
    group: "lab",
  },
  {
    id: "lab-avatar-editor",
    name: "Avatar Editor",
    description: "Avatar editor stage with skeleton-safe cloning tools.",
    icon: "🧑‍🎨",
    kind: "route",
    path: ROUTES.lab.avatarEditor,
    group: "tools",
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
    id: "lab-flowstate",
    name: "FlowState Panel",
    description: "Flow state monitoring and control panel.",
    icon: "🌊",
    kind: "route",
    path: ROUTES.lab.flowstate,
    group: "lab",
  },
  {
    id: "lab-evidence",
    name: "Evidence Viewer",
    description: "Trace evidence and artifact viewer.",
    icon: "🧾",
    kind: "route",
    path: ROUTES.lab.evidence,
    group: "lab",
  },
  {
    id: "lab-dashboard",
    name: "FlowState Dashboard",
    description: "FlowState monitoring dashboard and metrics.",
    icon: "📈",
    kind: "route",
    path: ROUTES.lab.dashboard,
    group: "lab",
  },
  {
    id: "lab-ecosystem",
    name: "Ecosystem Dashboard",
    description: "System ecosystem health and integration overview.",
    icon: "🌐",
    kind: "route",
    path: ROUTES.lab.ecosystem,
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
