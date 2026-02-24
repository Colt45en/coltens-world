import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard, GlassPanel, NeonButton, NeonTitle } from "../ui/neon";
import { WORLD_APPS, type WorldApp } from "../world/AppRegistry";
import { BootRedirect } from "../world/BootRedirect";
import { ROUTES } from "../world/routes";

type HealthState = "up" | "down" | "checking";

type ServiceHealth = {
  nucleus: HealthState;
  brain: HealthState;
  lexicon: HealthState;
  updatedAt: number;
};

const HEALTH_POLL_MS = 5000;

async function probeHttp(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function probeLexiconOperators(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { operators?: string[] };
    if (!Array.isArray(payload.operators)) return false;
    return payload.operators.length > 0;
  } catch {
    return false;
  }
}

function healthBadgeClass(state: HealthState): string {
  if (state === "up") return "bg-green-500/20 text-green-300 border-green-500/30";
  if (state === "down") return "bg-red-500/20 text-red-300 border-red-500/30";
  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

function healthLabel(state: HealthState): string {
  if (state === "up") return "UP";
  if (state === "down") return "DOWN";
  return "CHECKING";
}

function groupLabel(g?: string) {
  if (g === "core") return "CORE";
  if (g === "lab") return "LAB";
  if (g === "tools") return "TOOLS";
  if (g === "external") return "EXTERNAL";
  return "APPS";
}

export function LauncherPage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<ServiceHealth>({
    nucleus: "checking",
    brain: "checking",
    lexicon: "checking",
    updatedAt: Date.now(),
  });

  useEffect(() => {
    let disposed = false;

    const pollHealth = async () => {
      const [nucleusUp, brainUp, lexiconUp] = await Promise.all([
        probeHttp("http://localhost:3000"),
        probeHttp("http://127.0.0.1:8001/health"),
        probeLexiconOperators("http://127.0.0.1:8001/brain/operator/list"),
      ]);

      if (disposed) return;

      setHealth({
        nucleus: nucleusUp ? "up" : "down",
        brain: brainUp ? "up" : "down",
        lexicon: lexiconUp ? "up" : "down",
        updatedAt: Date.now(),
      });
    };

    pollHealth();
    const intervalId = setInterval(pollHealth, HEALTH_POLL_MS);

    return () => {
      disposed = true;
      clearInterval(intervalId);
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, WorldApp[]>();
    for (const a of WORLD_APPS) {
      const g = groupLabel(a.group);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(a);
    }
    return Array.from(map.entries());
  }, []);

  const launch = (app: WorldApp) => {
    if (app.kind === "route" && app.path) {
      navigate(app.path);
    } else if (app.kind === "iframe") {
      navigate(ROUTES.apps.byId(app.id));
    } else if (app.kind === "external" && app.url) {
      globalThis.open(app.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <BootRedirect enabled={true} />
      <div className="max-w-6xl mx-auto">
        <div className="text-center mt-2 mb-10">
          <NeonTitle as="h1" className="text-4xl sm:text-6xl">
            World Engine
          </NeonTitle>
          <p className="text-white/60 mt-3">Launch any application from one unified runtime.</p>

          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <NeonButton onClick={() => navigate(`${ROUTES.root}?home=1`)}>MAIN DASHBOARD</NeonButton>
            <NeonButton variant="ghost" onClick={() => navigate(ROUTES.lab.studio)}>
              OPEN STUDIO
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => navigate(ROUTES.lab.prefabEngine)}>
              PREFAB ENGINE
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => navigate(ROUTES.lab.avatarCompiler)}>
              AVATAR BUILD
            </NeonButton>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span
              className={`px-2 py-1 rounded-full text-[10px] border font-mono ${healthBadgeClass(health.nucleus)}`}
            >
              NUCLEUS: {healthLabel(health.nucleus)}
            </span>
            <span
              className={`px-2 py-1 rounded-full text-[10px] border font-mono ${healthBadgeClass(health.brain)}`}
            >
              BRAIN: {healthLabel(health.brain)}
            </span>
            <span
              className={`px-2 py-1 rounded-full text-[10px] border font-mono ${healthBadgeClass(health.lexicon)}`}
            >
              LEXICON: {healthLabel(health.lexicon)}
            </span>
            <span className="text-[10px] text-white/45 font-mono">
              UPDATED {new Date(health.updatedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Dashboards & Views Quick Access */}
        <GlassPanel className="rounded-2xl p-6 mb-10">
          <h2 className="font-scifi text-sm tracking-widest text-white/85 mb-4 flex items-center gap-2">
            <span className="text-cyan-400">📊</span>
            DASHBOARDS & VIEWS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => navigate(ROUTES.lab.dashboard)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🌊</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-400 transition-colors">
                    FlowState Dashboard
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Real-time flow monitoring & metrics
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.ecosystem)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🌍</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-400 transition-colors">
                    Ecosystem Dashboard
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Unified system monitoring & health
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.pipelineResults)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-400 transition-colors">
                    Pipeline Results
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Evidence, decisions & plan viewer
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.flowstate)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-400 transition-colors">
                    FlowState Lab
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Flow management & orchestration
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.evidence)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔍</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-400 transition-colors">
                    Evidence Lab
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Data collection & analysis
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.worldGraph)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🕸️</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-400 transition-colors">
                    World Graph
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Pattern graph & DSL simulation
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.nexus)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-400 transition-colors">
                    Nexus Pipeline
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Data flow & orchestration
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.nucleus)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚛️</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-400 transition-colors">
                    Nucleus Lab
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Real-time WebSocket monitoring
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.brain)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🧠</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-400 transition-colors">
                    Brain Lab
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    AI reasoning & decision engine
                  </div>
                </div>
              </div>
            </button>
          </div>
        </GlassPanel>

        {/* Engine Architecture Labs */}
        <GlassPanel className="rounded-2xl p-6 mb-10">
          <h2 className="font-scifi text-sm tracking-widest text-white/85 mb-4 flex items-center gap-2">
            <span className="text-purple-400">⚙️</span>
            ENGINE ARCHITECTURE LABS
          </h2>
          {/* Featured: World Engine Blueprint */}
          <button
            onClick={() => navigate(ROUTES.lab.worldEngineBlueprint)}
            className="w-full text-left p-5 rounded-xl bg-gradient-to-r from-purple-500/20 to-cyan-500/20 hover:from-purple-500/30 hover:to-cyan-500/30 border-2 border-purple-400/50 hover:border-cyan-400/70 transition-all group mb-4"
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl">🏗️</span>
              <div className="flex-1">
                <div className="font-scifi text-base text-white/95 group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                  World Engine Blueprint
                  <span className="text-[10px] px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                    COMPLETE
                  </span>
                </div>
                <div className="text-xs text-white/70 mt-2">
                  Complete architecture reference: Archetype ECS, Render Dependency Graph, Quaternions, Origin Rebasing, Terrain Erosion, and Command Pattern — all integrated with interactive demos.
                </div>
              </div>
            </div>
          </button>
          {/* Featured: Math Engine */}
          <button
            onClick={() => navigate(ROUTES.lab.mathEngine)}
            className="w-full text-left p-5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border-2 border-cyan-400/50 hover:border-blue-400/70 transition-all group mb-4"
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl">📐</span>
              <div className="flex-1">
                <div className="font-scifi text-base text-white/95 group-hover:text-blue-400 transition-colors flex items-center gap-2">
                  Math Engine
                  <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                    NEW
                  </span>
                </div>
                <div className="text-xs text-white/70 mt-2">
                  Environmental math utilities accessible to all systems: Unit Circle & Trig, Calculus & Derivatives, Vector Operations, Particle System, Physics Simulation, Camera Systems, 3D Geometry — centralized mathematical foundation for the entire World Engine.
                </div>
              </div>
            </div>
          </button>
          {/* Featured: Math Workspace */}
          <button
            onClick={() => navigate(ROUTES.lab.mathWorkspace)}
            className="w-full text-left p-5 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border-2 border-purple-400/50 hover:border-pink-400/70 transition-all group mb-4"
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl">📐</span>
              <div className="flex-1">
                <div className="font-scifi text-base text-white/95 group-hover:text-pink-400 transition-colors flex items-center gap-2">
                  3D Math Workspace
                  <span className="text-[10px] px-2 py-0.5 bg-pink-500/20 text-pink-300 rounded-full border border-pink-500/30">
                    NEW
                  </span>
                </div>
                <div className="text-xs text-white/70 mt-2">
                  Units & Dimensional Analysis (m/cm/mm/in/ft), Analytic Geometry Formulas (exact volume/surface area for all primitives), Mesh Validation (triangle integration to verify formulas), React Three Fiber with TransformControls, Custom Shader Grid, WebSocket Server Sync, Grid Texture Overlay, GLB Export.
                </div>
              </div>
            </div>
          </button>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => navigate(ROUTES.lab.graphicsGenerator)}
              className="text-left p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-400/50 hover:border-cyan-300 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎨</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-300 transition-colors">
                    Graphics Generator
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Math scene synthesis & quaternion animations
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.mathDependencyGraph)}
              className="text-left p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-400/50 hover:border-purple-300 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🕸️</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-purple-300 transition-colors">
                    Math Graph
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Visual math curriculum & dependency explorer
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.complexPlayground)}
              className="text-left p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-400/50 hover:border-blue-300 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🌀</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-blue-300 transition-colors">
                    Complex Numbers
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Fractals, domain coloring & complex arithmetic
                  </div>
                </div>
              </div>
            </button>

            <button              onClick={() => navigate(ROUTES.lab.matrixPlayground)}
              className="group bg-gradient-to-br from-pink/20 via-red/20 to-purple/30 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:border-pink-400/50 hover:shadow-lg hover:shadow-pink-500/20 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔢</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-pink-300 transition-colors">
                    Matrix Playground
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Linear algebra - 2D/3D transforms & projections
                  </div>
                </div>
              </div>
            </button>

            <button              onClick={() => navigate(ROUTES.lab.svgRendering)}
              className="group bg-gradient-to-br from-cyan/20 via-blue/20 to-teal/30 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">📐</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-300 transition-colors">
                    SVG Rendering Math
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Parametric lines & oscillating limbs
                  </div>
                </div>
              </div>
            </button>

            <button              onClick={() => navigate(ROUTES.lab.math3D)}
              className="group bg-gradient-to-br from-purple/20 via-violet/20 to-indigo/30 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🌌</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-purple-300 transition-colors">
                    3D Mathematics
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Vector3, limbs, noise & graph algorithms
                  </div>
                </div>
              </div>
            </button>

            <button              onClick={() => navigate(ROUTES.lab.physics)}
              className="group bg-gradient-to-br from-cyan/20 via-blue/20 to-teal/30 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚛️</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-cyan-300 transition-colors">
                    Physics Engine
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Gravity, collisions, player & enemy AI
                  </div>
                </div>
              </div>
            </button>

            <button              onClick={() => navigate(ROUTES.lab.vectorPhysics)}
              className="group bg-gradient-to-br from-orange/20 via-amber/20 to-yellow/30 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/20 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🦾</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-amber-300 transition-colors">
                    Vector Physics IK
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Inverse kinematics with constraints & collision
                  </div>
                </div>
              </div>
            </button>

            <button              onClick={() => navigate(ROUTES.lab.iconGenerator)}
              className="group bg-gradient-to-br from-purple/20 via-pink/20 to-orange/30 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎨</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-purple-300 transition-colors">
                    Icon Generator
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Deterministic SVG icons from blog titles
                  </div>
                </div>
              </div>
            </button>

            <button              onClick={() => navigate(ROUTES.lab.avatarEditor)}
              className="group bg-gradient-to-br from-emerald/20 via-teal/20 to-cyan/30 backdrop-blur-md border border-white/10 rounded-lg p-4 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">👤</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-emerald-300 transition-colors">
                    Avatar Editor
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Procedural rigging, morphs, clothes & animation
                  </div>
                </div>
              </div>
            </button>

            <button              onClick={() => navigate(ROUTES.lab.terrainErosion)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏔️</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-purple-400 transition-colors">
                    Terrain Erosion
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Particle hydraulic erosion
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.wfc)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🌊</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-purple-400 transition-colors">
                    Wave Function Collapse
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Procedural generation
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.ecsArchitecture)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🧩</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-purple-400 transition-colors">
                    ECS Architecture
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Archetype vs Sparse Set
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(ROUTES.lab.memoryAllocators)}
              className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">💾</span>
                <div className="flex-1">
                  <div className="font-scifi text-xs text-white/90 group-hover:text-purple-400 transition-colors">
                    Memory Allocators
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">
                    Linear, Stack, Pool
                  </div>
                </div>
              </div>
            </button>
          </div>
        </GlassPanel>

        {grouped.map(([group, apps]) => (
          <div key={group} className="mb-10">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="font-scifi tracking-widest text-xs text-white/60">{group}</div>
              <div className="text-xs text-white/40">{apps.length} apps</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {apps.map((app) => (
                <GlassCard key={app.id} onPress={() => launch(app)} className="p-4">
                  <div className="text-4xl drop-shadow-[0_0_10px_rgba(0,243,255,0.35)]">
                    {app.icon}
                  </div>
                  <div className="font-scifi text-xs tracking-widest text-white/85 text-center">
                    {app.name}
                  </div>
                  <div className="text-[11px] text-white/50 text-center px-2">
                    {app.description}
                  </div>

                  <div className="mt-2">
                    <span className="px-2 py-1 rounded-full text-[10px] border border-white/15 text-white/60">
                      {app.kind.toUpperCase()}
                    </span>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        ))}

        <GlassPanel className="rounded-2xl p-5">
          <div className="font-bold tracking-wide">How launching works</div>
          <ul className="text-sm text-white/65 mt-2 list-disc pl-5 space-y-1">
            <li>
              <b>route</b>: internal React page
            </li>
            <li>
              <b>iframe</b>: embedded app via <code>/apps/:id</code>
            </li>
            <li>
              <b>external</b>: opens new tab
            </li>
          </ul>
        </GlassPanel>
      </div>
    </>
  );
}
