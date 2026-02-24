import { useEffect, useRef, useState } from "react";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";
import { TabPanel, type Tab } from "../ui/TabPanel";
import { CalculusEngine, CalculusRenderer } from "../utils/mathEngine/calculus";
import { CameraSystem } from "../utils/mathEngine/camera";
import { MathEngine } from "../utils/mathEngine/core";
import { Geometry3D } from "../utils/mathEngine/geometry3d";
import { ParticleSystem } from "../utils/mathEngine/particles";
import { PhysicsRenderer, PhysicsSimulation } from "../utils/mathEngine/physics";
import { UnitCircleRenderer, type UnitCircleState } from "../utils/mathEngine/unitCircle";

export function LabMathEnginePage() {
  const tabs: Tab[] = [
    {
      id: "overview",
      label: "Math Engine Overview",
      content: <OverviewTab />,
    },
    {
      id: "unitCircle",
      label: "Unit Circle & Trig",
      content: <UnitCircleTab />,
    },
    {
      id: "calculus",
      label: "Calculus & Derivatives",
      content: <CalculusTab />,
    },
    {
      id: "vectors",
      label: "Vector Operations",
      content: <VectorsTab />,
    },
    {
      id: "particles",
      label: "Particle System",
      content: <ParticlesTab />,
    },
    {
      id: "physics",
      label: "Physics Simulation",
      content: <PhysicsTab />,
    },
    {
      id: "camera",
      label: "Camera Systems",
      content: <CameraTab />,
    },
    {
      id: "geometry3d",
      label: "3D Geometry",
      content: <Geometry3DTab />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <NeonTitle>Environmental Math Engine</NeonTitle>
        <div className="text-sm text-cyan-300/70">
          Centralized Mathematical Utilities for World Engine
        </div>
      </div>

      <GlassPanel className="p-6">
        <p className="text-gray-300 mb-4">
          The Math Engine provides reusable mathematical utilities accessible to any system in the
          World Engine. From trigonometry and vector math to physics simulations and particle
          systems, all components can leverage these battle-tested functions.
        </p>
        <div className="text-sm text-cyan-400/80">
          <strong>Global Access:</strong> Import <code className="bg-black/30 px-2 py-1 rounded">MathEngine</code> anywhere
          in the system to access trig, vector, random, lerp, and physics utilities.
        </div>
      </GlassPanel>

      <GlassPanel className="rounded-2xl">
        <TabPanel tabs={tabs} defaultTab="overview" />
      </GlassPanel>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6 p-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Math Engine Architecture</h3>
        <p className="text-gray-300 mb-4">
          The Math Engine is organized into specialized modules that handle different mathematical
          domains. Every module is accessible through the global <code>MathEngine</code> export.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassPanel className="p-5 bg-purple-500/5 border-purple-500/30">
          <h4 className="text-lg font-bold text-purple-400 mb-3">🔄 Trigonometry</h4>
          <div className="text-sm text-gray-300 space-y-2">
            <div>
              <code className="text-cyan-400">MathEngine.trig.degToRad()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.trig.unitCirclePoint()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.trig.allValues()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.trig.quadrant()</code>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 bg-cyan-500/5 border-cyan-500/30">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">📐 Vector Math</h4>
          <div className="text-sm text-gray-300 space-y-2">
            <div>
              <code className="text-cyan-400">MathEngine.vector.add()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.vector.magnitude()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.vector.normalize()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.vector.dot()</code>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 bg-green-500/5 border-green-500/30">
          <h4 className="text-lg font-bold text-green-400 mb-3">🎲 Random Utilities</h4>
          <div className="text-sm text-gray-300 space-y-2">
            <div>
              <code className="text-cyan-400">MathEngine.random.range()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.random.int()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.random.color()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.random.bool()</code>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 bg-orange-500/5 border-orange-500/30">
          <h4 className="text-lg font-bold text-orange-400 mb-3">⚙️ Physics</h4>
          <div className="text-sm text-gray-300 space-y-2">
            <div>
              <code className="text-cyan-400">MathEngine.physics.friction()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.physics.gravityComponent()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.physics.normalForce()</code>
            </div>
            <div>
              <code className="text-cyan-400">MathEngine.physics.dragForce()</code>
            </div>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-6 bg-blue-500/5 border-blue-500/30">
        <h4 className="text-lg font-bold text-blue-400 mb-3">Usage Example</h4>
        <pre className="bg-black/50 p-4 rounded text-sm text-gray-300 overflow-x-auto">
{`import { MathEngine } from "@/utils/mathEngine/core";

// Trigonometry
const point = MathEngine.trig.unitCirclePoint(45);
console.log(point); // { x: 0.707, y: 0.707 }

// Vector operations
const v1 = [3, 4] as [number, number];
const magnitude = MathEngine.vector.magnitude(v1); // 5
const normalized = MathEngine.vector.normalize(v1); // [0.6, 0.8]

// Random generation
const randomAngle = MathEngine.random.range(0, 360);
const randomColor = MathEngine.random.color(); // "hsl(230, 70%, 60%)"

// Physics calculations
const normal = MathEngine.physics.normalForce(2, 9.8, 30); // mass, gravity, angle
const friction = MathEngine.physics.friction(normal, 0.5); // normal, coefficient`}
        </pre>
      </GlassPanel>

      <GlassPanel className="p-6">
        <h4 className="text-lg font-bold text-cyan-400 mb-3">System Integration</h4>
        <p className="text-gray-300 mb-3">
          The Math Engine is designed to be accessed globally throughout the World Engine
          architecture:
        </p>
        <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
          <li>
            <strong className="text-purple-400">Terrain Generation:</strong> Uses trig for slope
            calculations and random for noise
          </li>
          <li>
            <strong className="text-cyan-400">ECS Systems:</strong> Vector math for transformations
            and physics
          </li>
          <li>
            <strong className="text-green-400">Render Graph:</strong> Interpolation for transitions
            and lerp utilities
          </li>
          <li>
            <strong className="text-orange-400">Particle Effects:</strong> Random generation and
            vector operations for movement
          </li>
        </ul>
      </GlassPanel>
    </div>
  );
}

function UnitCircleTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [angle, setAngle] = useState(45);
  const [autoRotate, setAutoRotate] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rendererRef = useRef<UnitCircleRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current = new UnitCircleRenderer(canvasRef.current, 120);
  }, []);

  useEffect(() => {
    if (!rendererRef.current) return;

    const state: UnitCircleState = {
      angle,
      highlightQuadrant: MathEngine.trig.quadrant(angle),
      showLabels: true,
      showGrid: true,
    };

    rendererRef.current.render(state);
  }, [angle]);

  useEffect(() => {
    if (!autoRotate) return;

    const interval = setInterval(() => {
      setAngle((a) => (a + speed) % 360);
    }, 16);

    return () => clearInterval(interval);
  }, [autoRotate, speed]);

  const values = MathEngine.trig.allValues(angle);
  const quadrant = MathEngine.trig.quadrant(angle);

  return (
    <div className="space-y-6 p-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Unit Circle & Trigonometry</h3>
        <p className="text-gray-300">
          Interactive visualization of the unit circle. Any point on the circle is (cos θ, sin θ).
          Drag the angle slider or enable auto-rotation to see how sine and cosine change.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Visualization</h4>
          <canvas
            ref={canvasRef}
            width={350}
            height={350}
            className="w-full border border-purple-500/30 rounded bg-black/50"
          />
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Angle: {angle.toFixed(1)}°</label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={angle}
                onChange={(e) => setAngle(parseFloat(e.target.value))}
                className="w-full"
                aria-label="Unit circle angle in degrees"
              />
            </div>
            <div className="flex gap-2">
              <NeonButton onClick={() => setAutoRotate(!autoRotate)}>
                {autoRotate ? "⏸ Pause" : "▶ Auto Rotate"}
              </NeonButton>
              <NeonButton onClick={() => setAngle(0)}>Reset</NeonButton>
            </div>
            {autoRotate && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Speed: {speed}x</label>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full"
                  aria-label="Auto-rotation speed"
                />
              </div>
            )}
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">Values</h4>
          <div className="space-y-4">
            <div className="p-4 bg-cyan-500/10 rounded border border-cyan-500/30">
              <div className="text-sm text-gray-400">Quadrant</div>
              <div className="text-3xl font-mono font-bold text-cyan-400">{quadrant}</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-purple-500/10 rounded border border-purple-500/30 text-center">
                <div className="text-xs text-gray-400">cos(θ)</div>
                <div className="text-lg font-mono font-bold text-purple-300">
                  {values.cos.toFixed(3)}
                </div>
              </div>
              <div className="p-3 bg-green-500/10 rounded border border-green-500/30 text-center">
                <div className="text-xs text-gray-400">sin(θ)</div>
                <div className="text-lg font-mono font-bold text-green-300">
                  {values.sin.toFixed(3)}
                </div>
              </div>
              <div className="p-3 bg-orange-500/10 rounded border border-orange-500/30 text-center">
                <div className="text-xs text-gray-400">tan(θ)</div>
                <div className="text-lg font-mono font-bold text-orange-300">
                  {Math.abs(values.tan) > 100 ? "∞" : values.tan.toFixed(3)}
                </div>
              </div>
            </div>
            <div className="p-3 bg-blue-500/10 rounded border border-blue-500/30">
              <div className="text-sm text-gray-400 mb-2">Radians</div>
              <div className="text-lg font-mono text-blue-300">{values.rad.toFixed(4)} rad</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-black/30 rounded">
            <h5 className="text-sm font-bold text-cyan-400 mb-2">CAST Rule (Quadrant Signs)</h5>
            <div className="text-xs text-gray-300 space-y-1">
              <div>
                <strong className="text-purple-400">Q1 (0°-90°):</strong> All positive
              </div>
              <div>
                <strong className="text-green-400">Q2 (90°-180°):</strong> Sin positive
              </div>
              <div>
                <strong className="text-orange-400">Q3 (180°-270°):</strong> Tan positive
              </div>
              <div>
                <strong className="text-cyan-400">Q4 (270°-360°):</strong> Cos positive
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function ParticlesTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [particleCount, setParticleCount] = useState(50);
  const systemRef = useRef<ParticleSystem | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    systemRef.current = new ParticleSystem(canvasRef.current, 200);

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (systemRef.current && ctx) {
        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        systemRef.current.update(dt);
        systemRef.current.render(ctx);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const spawnParticles = () => {
    if (systemRef.current) {
      systemRef.current.spawn(particleCount);
    }
  };

  const clearParticles = () => {
    if (systemRef.current) {
      systemRef.current.clear();
    }
  };

  const spawnExplosion = () => {
    if (systemRef.current && canvasRef.current) {
      const centerX = canvasRef.current.width / 2;
      const centerY = canvasRef.current.height / 2;

      for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        const speed = MathEngine.random.range(2, 6);
        systemRef.current.spawn(1, {
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          maxLife: 2,
        });
      }
    }
  };

  return (
    <div className="space-y-6 p-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Particle System</h3>
        <p className="text-gray-300">
          Procedural particle generation with physics simulation. Particles have position, velocity,
          rotation, color, and lifetime. The system handles spawning, updating, and rendering.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Particle Canvas</h4>
          <canvas
            ref={canvasRef}
            width={500}
            height={400}
            className="w-full border border-purple-500/30 rounded bg-black"
          />
          <div className="mt-4 text-sm text-gray-400 text-center">
            Active Particles: {systemRef.current?.getCount() ?? 0}
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">Controls</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Spawn Count: {particleCount}
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                value={particleCount}
                onChange={(e) => setParticleCount(parseInt(e.target.value))}
                className="w-full"
                aria-label="Number of particles to spawn"
              />
            </div>
            <div className="flex flex-col gap-2">
              <NeonButton onClick={spawnParticles}>✨ Spawn Particles</NeonButton>
              <NeonButton onClick={spawnExplosion}>💥 Explosion</NeonButton>
              <NeonButton onClick={clearParticles}>🗑️ Clear All</NeonButton>
            </div>
          </div>

          <div className="mt-6 p-4 bg-black/30 rounded">
            <h5 className="text-sm font-bold text-cyan-400 mb-2">Particle Properties</h5>
            <div className="text-xs text-gray-300 space-y-1">
              <div>• Position (x, y)</div>
              <div>• Velocity (vx, vy)</div>
              <div>• Rotation & rotation speed</div>
              <div>• Size & color (random HSL)</div>
              <div>• Lifetime & decay</div>
              <div>• Gravity simulation</div>
              <div>• Edge bouncing</div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded">
            <h5 className="text-sm font-bold text-green-400 mb-2">Integration Example</h5>
            <pre className="text-xs text-gray-300 overflow-x-auto">
{`import { ParticleSystem } from "@/utils/mathEngine/particles";

const system = new ParticleSystem(canvas);
system.spawn(50); // spawn 50 particles

// Update loop
system.update(deltaTime);
system.render(ctx);`}
            </pre>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function PhysicsTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [simulation] = useState(() => new PhysicsSimulation());
  const [renderer, setRenderer] = useState<PhysicsRenderer | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const animationRef = useRef<number>(0);

  const [angle, setAngle] = useState(20);
  const [muStatic, setMuStatic] = useState(0.5);
  const [muKinetic, setMuKinetic] = useState(0.4);

  useEffect(() => {
    if (!canvasRef.current) return;
    const r = new PhysicsRenderer(canvasRef.current, 400);
    setRenderer(r);
    r.render(simulation);
  }, []);

  useEffect(() => {
    simulation.updateParams({ angle, muStatic, muKinetic });
    if (renderer) {
      renderer.render(simulation);
    }
  }, [angle, muStatic, muKinetic]);

  useEffect(() => {
    if (!isRunning || !renderer) return;

    let lastTime = performance.now();
    const fixedDt = 1 / 60;

    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      simulation.step(fixedDt);
      renderer.render(simulation);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, renderer]);

  const handleReset = () => {
    simulation.reset();
    if (renderer) {
      renderer.render(simulation);
    }
  };

  const handleNudge = () => {
    simulation.nudge(2);
    if (!isRunning) {
      setIsRunning(true);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Physics Simulation</h3>
        <p className="text-gray-300">
          Friction and forces on an inclined plane. Demonstrates static vs kinetic friction,
          gravity components, and drag forces. Based on real physics equations.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Simulation</h4>
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="w-full border border-purple-500/30 rounded bg-black"
          />
          <div className="mt-4 flex gap-2">
            <NeonButton onClick={() => setIsRunning(!isRunning)}>
              {isRunning ? "⏸ Pause" : "▶ Play"}
            </NeonButton>
            <NeonButton onClick={handleNudge}>👉 Nudge</NeonButton>
            <NeonButton onClick={handleReset}>🔄 Reset</NeonButton>
          </div>
          <div className="mt-3 p-3 bg-black/30 rounded text-sm">
            <div className="text-cyan-400 font-bold mb-2">Status</div>
            <div className="text-gray-300 space-y-1">
              <div>
                Mode: <span className={simulation.state.stuck ? "text-orange-400" : "text-green-400"}>
                  {simulation.state.stuck ? "STATIC (stuck)" : "KINETIC (sliding)"}
                </span>
              </div>
              <div>Position: {simulation.state.position.toFixed(2)} m</div>
              <div>Velocity: {simulation.state.velocity.toFixed(2)} m/s</div>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">Parameters</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Angle: {angle.toFixed(1)}°
              </label>
              <input
                type="range"
                min="-30"
                max="45"
                step="0.5"
                value={angle}
                onChange={(e) => setAngle(parseFloat(e.target.value))}
                className="w-full"
                aria-label="Incline angle in degrees"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                μ<sub>s</sub> (Static Friction): {muStatic.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1.2"
                step="0.05"
                value={muStatic}
                onChange={(e) => setMuStatic(parseFloat(e.target.value))}
                className="w-full"
                aria-label="Static friction coefficient"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                μ<sub>k</sub> (Kinetic Friction): {muKinetic.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1.2"
                step="0.05"
                value={muKinetic}
                onChange={(e) => setMuKinetic(parseFloat(e.target.value))}
                className="w-full"
                aria-label="Kinetic friction coefficient"
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-black/30 rounded">
            <h5 className="text-sm font-bold text-cyan-400 mb-2">Force Vectors</h5>
            <div className="text-xs text-gray-300 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-[#9ed2ff]"></div>
                <span>Gravity Parallel (blue)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-[#ffb86b]"></div>
                <span>Friction (orange)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-white"></div>
                <span>Net Force (white)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded">
            <h5 className="text-sm font-bold text-blue-400 mb-2">Physics Equations</h5>
            <div className="text-xs text-gray-300 space-y-2">
              <div>N = mg·cos(θ)</div>
              <div>F<sub>g∥</sub> = mg·sin(θ)</div>
              <div>F<sub>s</sub> ≤ μ<sub>s</sub>·N</div>
              <div>F<sub>k</sub> = μ<sub>k</sub>·N</div>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function CalculusTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setRenderer] = useState<CalculusRenderer | null>(null);
  const [x, setX] = useState(0);
  const [selectedFunction, setSelectedFunction] = useState<"quadratic" | "sine" | "cubic">("quadratic");

  useEffect(() => {
    if (!canvasRef.current) return;
    setRenderer(new CalculusRenderer(canvasRef.current));
  }, []);

  useEffect(() => {
    if (!renderer) return;

    renderer.clear();
    const originX = 300;
    const originY = 250;
    const scaleX = 50;
    const scaleY = 50;

    renderer.drawAxes(originX, originY, scaleX, scaleY);

    // Define function based on selection
    let f: (x: number) => number;
    let fName: string;

    switch (selectedFunction) {
      case "quadratic":
        f = (x) => 0.1 * x * x;
        fName = "f(x) = 0.1x²";
        break;
      case "sine":
        f = (x) => Math.sin(x);
        fName = "f(x) = sin(x)";
        break;
      case "cubic":
        f = (x) => 0.01 * x * x * x - 0.3 * x;
        fName = "f(x) = 0.01x³ - 0.3x";
        break;
    }

    // Draw function
    renderer.drawFunction(f, originX, originY, scaleX, scaleY, "#00eaff");

    // Calculate derivative at x (slope)
    const derivative = CalculusEngine.derivative(f, x);
    const y = f(x);

    // Draw tangent line
    renderer.drawTangent(x, y, derivative, originX, originY, scaleX, scaleY);
  }, [renderer, x, selectedFunction]);

  const functions: Array<{ value: "quadratic" | "sine" | "cubic"; label: string }> = [
    { value: "quadratic", label: "Quadratic (x²)" },
    { value: "sine", label: "Sine Wave" },
    { value: "cubic", label: "Cubic (x³)" },
  ];

  return (
    <div className="space-y-6 p-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Calculus & Derivatives</h3>
        <p className="text-gray-300">
          Visualize derivatives as instantaneous rates of change. The tangent line at any point shows the derivative (slope) at that location.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Function Graph</h4>
          <canvas
            ref={canvasRef}
            width={600}
            height={500}
            className="w-full border border-purple-500/30 rounded bg-black"
          />
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">Controls</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Function</label>
              <select
                value={selectedFunction}
                onChange={(e) => setSelectedFunction(e.target.value as any)}
                className="w-full bg-black/50 border border-cyan-500/30 rounded px-3 py-2 text-white"
              >
                {functions.map((fn) => (
                  <option key={fn.value} value={fn.value}>
                    {fn.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">X Position: {x.toFixed(2)}</label>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={x}
                onChange={(e) => setX(parseFloat(e.target.value))}
                className="w-full"
                aria-label="X position for derivative calculation"
              />
            </div>

            <div className="p-4 bg-cyan-500/10 rounded border border-cyan-500/30">
              <h5 className="text-sm font-bold text-cyan-400 mb-2">Derivative at x = {x.toFixed(2)}</h5>
              <div className="text-lg font-mono text-cyan-300">
                f'(x) ≈ {CalculusEngine.derivative((xx) => {
                  switch (selectedFunction) {
                    case "quadratic": return 0.1 * xx * xx;
                    case "sine": return Math.sin(xx);
                    case "cubic": return 0.01 * xx * xx * xx - 0.3 * xx;
                  }
                }, x).toFixed(3)}
              </div>
            </div>

            <div className="p-4 bg-black/30 rounded">
              <h5 className="text-sm font-bold text-cyan-400 mb-2">What is a Derivative?</h5>
              <p className="text-xs text-gray-300">
                The derivative measures how fast a function is changing at a specific point. Geometrically, it's the slope of the tangent line (red line) touching the curve at that point.
              </p>
            </div>

            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded">
              <h5 className="text-sm font-bold text-green-400 mb-2">Applications</h5>
              <ul className="text-xs text-gray-300 space-y-1">
                <li>• Velocity = derivative of position</li>
                <li>• Acceleration = derivative of velocity</li>
                <li>• Optimization in game AI</li>
                <li>• Animation curves and easing</li>
              </ul>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function VectorsTab() {
  const [v1, setV1] = useState<[number, number]>([3, 4]);
  const [v2, setV2] = useState<[number, number]>([2, 3]);

  const sum = MathEngine.vector.add(v1, v2);
  const difference = MathEngine.vector.sub(v1, v2);
  const dot = MathEngine.vector.dot(v1, v2);
  const angle1 = MathEngine.vector.angle(v1);
  const angle2 = MathEngine.vector.angle(v2);

  return (
    <div className="space-y-6 p-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Vector Operations</h3>
        <p className="text-gray-300">
          Vectors represent direction and magnitude. Essential for movement, physics, AI pathfinding, and camera systems.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Input Vectors</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Vector A: ({v1[0].toFixed(1)}, {v1[1].toFixed(1)})</label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.5"
                  value={v1[0]}
                  onChange={(e) => setV1([parseFloat(e.target.value), v1[1]])}
                  className="w-full"
                  aria-label="Vector A X component"
                />
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.5"
                  value={v1[1]}
                  onChange={(e) => setV1([v1[0], parseFloat(e.target.value)])}
                  className="w-full"
                  aria-label="Vector A Y component"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Vector B: ({v2[0].toFixed(1)}, {v2[1].toFixed(1)})</label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.5"
                  value={v2[0]}
                  onChange={(e) => setV2([parseFloat(e.target.value), v2[1]])}
                  className="w-full"
                  aria-label="Vector B X component"
                />
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.5"
                  value={v2[1]}
                  onChange={(e) => setV2([v2[0], parseFloat(e.target.value)])}
                  className="w-full"
                  aria-label="Vector B Y component"
                />
              </div>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">Results</h4>
          <div className="space-y-3">
            <div className="p-3 bg-purple-500/10 rounded border border-purple-500/30">
              <div className="text-sm text-gray-400">Addition (A + B)</div>
              <div className="text-lg font-mono text-purple-300">({sum[0].toFixed(2)}, {sum[1].toFixed(2)})</div>
              <div className="text-xs text-gray-400 mt-1">Magnitude: {MathEngine.vector.magnitude(sum).toFixed(2)}</div>
            </div>

            <div className="p-3 bg-cyan-500/10 rounded border border-cyan-500/30">
              <div className="text-sm text-gray-400">Subtraction (A - B)</div>
              <div className="text-lg font-mono text-cyan-300">({difference[0].toFixed(2)}, {difference[1].toFixed(2)})</div>
            </div>

            <div className="p-3 bg-green-500/10 rounded border border-green-500/30">
              <div className="text-sm text-gray-400">Dot Product (A · B)</div>
              <div className="text-lg font-mono text-green-300">{dot.toFixed(2)}</div>
            </div>

            <div className="p-3 bg-orange-500/10 rounded border border-orange-500/30">
              <div className="text-sm text-gray-400">Angles</div>
              <div className="text-lg font-mono text-orange-300">A: {(angle1 * 180 / Math.PI).toFixed(1)}° | B: {(angle2 * 180 / Math.PI).toFixed(1)}°</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-black/30 rounded">
            <h5 className="text-sm font-bold text-cyan-400 mb-2">Vector Operations</h5>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• <strong>Addition:</strong> Combine forces/velocities</li>
              <li>• <strong>Dot Product:</strong> Projection, angle detection</li>
              <li>• <strong>Magnitude:</strong> Speed, distance</li>
              <li>• <strong>Normalize:</strong> Direction without magnitude</li>
            </ul>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function CameraTab() {
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [fov, setFov] = useState(60);

  const camera = CameraSystem.create({ x: 0, y: 0, z: 5 }, yaw, pitch, 0, fov);
  const forward = CameraSystem.getForward(camera);
  const right = CameraSystem.getRight(camera);
  const up = CameraSystem.getUp(camera);

  return (
    <div className="space-y-6 p-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Camera Systems</h3>
        <p className="text-gray-300">
          3D camera control via yaw/pitch rotations. Used for FPS cameras, orbit controls, and cinematic systems.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Camera Controls</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Yaw: {yaw.toFixed(0)}°</label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={yaw}
                onChange={(e) => setYaw(parseFloat(e.target.value))}
                className="w-full"
                aria-label="Camera yaw rotation"
              />
              <div className="text-xs text-gray-400 mt-1">Horizontal rotation (left/right)</div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Pitch: {pitch.toFixed(0)}°</label>
              <input
                type="range"
                min="-89"
                max="89"
                step="1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full"
                aria-label="Camera pitch rotation"
              />
              <div className="text-xs text-gray-400 mt-1">Vertical rotation (up/down)</div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">FOV: {fov.toFixed(0)}°</label>
              <input
                type="range"
                min="30"
                max="120"
                step="1"
                value={fov}
                onChange={(e) => setFov(parseFloat(e.target.value))}
                className="w-full"
                aria-label="Camera field of view"
              />
              <div className="text-xs text-gray-400 mt-1">Field of view (zoom)</div>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">Camera Vectors</h4>
          <div className="space-y-3">
            <div className="p-3 bg-blue-500/10 rounded border border-blue-500/30">
              <div className="text-sm text-gray-400">Forward Vector</div>
              <div className="text-sm font-mono text-blue-300">
                ({forward.x.toFixed(3)}, {forward.y.toFixed(3)}, {forward.z.toFixed(3)})
              </div>
              <div className="text-xs text-gray-400 mt-1">Direction camera is looking</div>
            </div>

            <div className="p-3 bg-green-500/10 rounded border border-green-500/30">
              <div className="text-sm text-gray-400">Right Vector</div>
              <div className="text-sm font-mono text-green-300">
                ({right.x.toFixed(3)}, {right.y.toFixed(3)}, {right.z.toFixed(3)})
              </div>
              <div className="text-xs text-gray-400 mt-1">Strafe movement direction</div>
            </div>

            <div className="p-3 bg-purple-500/10 rounded border border-purple-500/30">
              <div className="text-sm text-gray-400">Up Vector</div>
              <div className="text-sm font-mono text-purple-300">
                ({up.x.toFixed(3)}, {up.y.toFixed(3)}, {up.z.toFixed(3)})
              </div>
              <div className="text-xs text-gray-400 mt-1">Camera local up direction</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-black/30 rounded">
            <h5 className="text-sm font-bold text-cyan-400 mb-2">Camera Applications</h5>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• <strong>FPS Camera:</strong> WASD movement with mouse look</li>
              <li>• <strong>Orbit Camera:</strong> Rotate around target point</li>
              <li>• <strong>Cinematics:</strong> Smooth camera paths</li>
              <li>• <strong>View Matrices:</strong> Transform world to screen</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded">
            <h5 className="text-sm font-bold text-orange-400 mb-2">Coordinate System</h5>
            <div className="text-xs text-gray-300">
              • <strong>Yaw:</strong> Rotation around Y axis (compass)<br/>
              • <strong>Pitch:</strong> Rotation around X axis (up/down)<br/>
              • <strong>Roll:</strong> Rotation around Z axis (tilt)
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function Geometry3DTab() {
  const [rayAngle, setRayAngle] = useState(0);

  // Example AABB and sphere
  const box = Geometry3D.aabb.create(
    { x: -1, y: -1, z: -1 },
    { x: 1, y: 1, z: 1 }
  );

  const sphere = Geometry3D.sphere.create({ x: 0, y: 0, z: 0 }, 2);

  // Create ray from angle
  const rayOrigin = { x: 0, y: 0, z: -5 };
  const rayDirection = {
    x: Math.sin((rayAngle * Math.PI) / 180),
    y: 0,
    z: Math.cos((rayAngle * Math.PI) / 180),
  };
  const ray = Geometry3D.ray.create(rayOrigin, rayDirection);

  const boxHit = Geometry3D.ray.intersectAABB(ray, box);
  const sphereHit = Geometry3D.ray.intersectSphere(ray, sphere);

  return (
    <div className="space-y-6 p-6">
      <GlassPanel className="p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">3D Geometry</h3>
        <p className="text-gray-300">
          Collision detection, raycasting, and frustum culling for 3D games and engines.
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-purple-400 mb-3">Raycasting Demo</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Ray Angle: {rayAngle.toFixed(0)}°</label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={rayAngle}
                onChange={(e) => setRayAngle(parseFloat(e.target.value))}
                className="w-full"
                aria-label="Ray casting angle"
              />
            </div>

            <div className="p-3 bg-cyan-500/10 rounded border border-cyan-500/30">
              <h5 className="text-sm font-bold text-cyan-400 mb-2">Ray Origin</h5>
              <div className="text-sm font-mono text-cyan-300">
                ({rayOrigin.x}, {rayOrigin.y}, {rayOrigin.z})
              </div>
            </div>

            <div className="p-3 bg-blue-500/10 rounded border border-blue-500/30">
              <h5 className="text-sm font-bold text-blue-400 mb-2">Ray Direction</h5>
              <div className="text-sm font-mono text-blue-300">
                ({rayDirection.x.toFixed(3)}, {rayDirection.y.toFixed(3)}, {rayDirection.z.toFixed(3)})
              </div>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h4 className="text-lg font-bold text-cyan-400 mb-3">Intersection Results</h4>
          <div className="space-y-3">
            <div className={`p-3 rounded border ${boxHit.hit ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
              <div className="text-sm text-gray-400">AABB Intersection</div>
              <div className="text-lg font-mono">
                {boxHit.hit ? (
                  <span className="text-green-400">HIT at distance {boxHit.distance.toFixed(3)}</span>
                ) : (
                  <span className="text-red-400">MISS</span>
                )}
              </div>
            </div>

            <div className={`p-3 rounded border ${sphereHit.hit ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
              <div className="text-sm text-gray-400">Sphere Intersection</div>
              <div className="text-lg font-mono">
                {sphereHit.hit ? (
                  <span className="text-green-400">HIT at distance {sphereHit.distance.toFixed(3)}</span>
                ) : (
                  <span className="text-red-400">MISS</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-black/30 rounded">
            <h5 className="text-sm font-bold text-cyan-400 mb-2">Bounding Volumes</h5>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• <strong>AABB:</strong> Axis-Aligned Bounding Box (fast)</li>
              <li>• <strong>Sphere:</strong> Simplest collision test</li>
              <li>• <strong>OBB:</strong> Oriented Bounding Box (accurate)</li>
              <li>• <strong>Raycasting:</strong> Mouse picking, bullets, vision</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded">
            <h5 className="text-sm font-bold text-purple-400 mb-2">Frustum Culling</h5>
            <p className="text-xs text-gray-300">
              Skip rendering objects outside camera view. Massive performance optimization for large worlds.
            </p>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
