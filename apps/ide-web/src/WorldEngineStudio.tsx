import {
  Activity,
  AlertCircle,
  Cpu,
  Frown,
  GitCommit,
  Layers,
  Move,
  RefreshCw,
  RotateCw,
  Save,
  Terminal,
  TrendingUp,
  Wind,
  Zap
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * WORLD ENGINE TIER 5 - KINETIC EVOLUTION
 * Introducing Transformations + Quaternions for 3D Spatial Operations
 */

// --- Types ---
type Vector3 = { x: number; y: number; z: number };
type Quaternion = { x: number; y: number; z: number; w: number };
type Vector5 = { p: number; i: number; g: number; c: number; f: number };
type OperatorType = "RB" | "UP" | "ST" | "PRV" | "EDT" | "RST" | "TRX" | "ROT";
type BuildStatus = "success" | "error" | "building";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "op" | "alert" | "info" | "critical";
  message: string;
}

// --- Constants ---
const CONFIG = {
  decayRate: 0.008,
  confidenceRecovery: 0.002,
  maxHistory: 25,
  frustrationThreshold: 0.6,
};

// --- Engine Logic ---
class Tier5Engine {
  state: Vector5;
  position: Vector3 = { x: 0, y: 0, z: 0 };
  quaternion: Quaternion = { x: 0, y: 0, z: 0, w: 1 };
  scale: Vector3 = { x: 1, y: 1, z: 1 };
  momentum: number = 0;
  mu: number = 0;
  buildTicks: number = 0;
  lastOpTime: number = Date.now();

  constructor() {
    this.state = {
      p: 0.1, // Polarity
      i: 0, // Intensity
      g: 0.5, // Generality
      c: 1, // Confidence
      f: 0, // Frustration
    };
  }

  tick(buildStatus: BuildStatus) {
    // 1. Intensity Natural Decay
    this.state.i = Math.max(0, this.state.i - CONFIG.decayRate);

    // 2. Momentum Decay (Velocity of actions)
    this.momentum *= 0.95;

    // 3. Build Status Impact
    if (buildStatus === "error") {
      this.buildTicks++;
      this.state.c = Math.max(0.1, this.state.c - 0.015);
      // Frustration builds faster when the build is broken
      this.state.f = Math.min(1, this.state.f + 0.005 * (this.state.i + 1));
    } else {
      this.buildTicks = 0;
      this.state.f = Math.max(0, this.state.f - 0.01);
      if (this.state.c < 1) this.state.c += CONFIG.confidenceRecovery;
    }

    // 4. Intensity/Entropy Physics
    if (this.state.i > 1.8) {
      this.state.c -= 0.004;
      this.state.f += 0.002;
    }

    // 5. Complexity (Mu) Calculation (Tier 5 variant)
    // Now factors in Frustration and Momentum
    const baseMu = (this.state.i * this.state.g) / (this.state.c + 0.1);
    this.mu = baseMu * (1 + this.state.f) + (this.momentum * 0.2);

    // Clamp all
    this.clamp();
  }

  applyOperator(op: OperatorType, strength: number = 1) {
    const now = Date.now();
    const delta = now - this.lastOpTime;
    this.lastOpTime = now;

    // Momentum increase (inverse of time delta)
    const burst = Math.min(2, 500 / (delta + 1));
    this.momentum += 0.2 * burst;

    switch (op) {
      case "RB":
        this.state.p = -0.9 * strength;
        this.state.i += 0.6;
        this.state.g += 0.3;
        this.state.c *= 0.9;
        break;
      case "ST":
        this.state.c = 1;
        this.state.i *= 0.5;
        this.state.f *= 0.2;
        this.momentum = 0;
        break;
      case "TRX": // Transform: Move in 3D space
        this.position.x += (Math.random() - 0.5) * 2 * strength;
        this.position.y += (Math.random() - 0.5) * 2 * strength;
        this.position.z += (Math.random() - 0.5) * 2 * strength;
        this.scale.x = Math.max(0.1, Math.min(3, this.scale.x + (Math.random() - 0.5) * 0.5));
        this.scale.y = Math.max(0.1, Math.min(3, this.scale.y + (Math.random() - 0.5) * 0.5));
        this.scale.z = Math.max(0.1, Math.min(3, this.scale.z + (Math.random() - 0.5) * 0.5));
        this.state.i += 0.15 * strength;
        break;
      case "ROT": { // Rotate: Apply quaternion rotation
        const angle = (Math.random() * Math.PI * strength) / 2;
        const axis = {
          x: Math.random() - 0.5,
          y: Math.random() - 0.5,
          z: Math.random() - 0.5,
        };
        const len = Math.sqrt(axis.x ** 2 + axis.y ** 2 + axis.z ** 2);
        axis.x /= len;
        axis.y /= len;
        axis.z /= len;

        const halfAngle = angle / 2;
        const sinHalf = Math.sin(halfAngle);
        const quat = {
          x: axis.x * sinHalf,
          y: axis.y * sinHalf,
          z: axis.z * sinHalf,
          w: Math.cos(halfAngle),
        };

        // Multiply quaternions
        this.quaternion = this.multiplyQuaternions(this.quaternion, quat);
        this.state.i += 0.2 * strength;
        this.state.c -= 0.005;
        break;
      }
      case "PRV":
        this.state.i += 0.2;
        this.state.f += 0.05;
        break;
      case "RST":
        this.state = { p: 0, i: 0, g: 0.5, c: 1, f: 0 };
        this.position = { x: 0, y: 0, z: 0 };
        this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
        this.scale = { x: 1, y: 1, z: 1 };
        this.momentum = 0;
        break;
      case "UP":
        this.state.c = Math.min(1, this.state.c + 0.05);
        this.state.f *= 0.8;
        break;
    }
    this.clamp();
  }

  multiplyQuaternions(q1: Quaternion, q2: Quaternion): Quaternion {
    return {
      x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
      y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
      z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
      w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z,
    };
  }

  clamp() {
    this.state.i = Math.min(3, Math.max(0, this.state.i));
    this.state.g = Math.min(3, Math.max(0, this.state.g));
    this.state.p = Math.min(1, Math.max(-1, this.state.p));
    this.state.c = Math.min(1, Math.max(0, this.state.c));
    this.state.f = Math.min(1, Math.max(0, this.state.f));
  }
}

// --- UI Components ---

const MetricBar = ({ label, value, color, max = 1, min = 0, icon: Icon }: any) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="space-y-1.5 group">
      <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-slate-500 group-hover:text-slate-300 transition-colors">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3 h-3" />}
          {label}
        </div>
        <span>{value.toFixed(3)}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
        <div
          className={`h-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(0,0,0,0.5)] ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const OpButton = ({ op, icon: Icon, label, onClick, active, theme = "indigo" }: any) => {
  const themes: any = {
    indigo: "hover:bg-indigo-500/10 hover:border-indigo-500/50 text-indigo-400",
    rose: "hover:bg-rose-500/10 hover:border-rose-500/50 text-rose-400",
    amber: "hover:bg-amber-500/10 hover:border-amber-500/50 text-amber-400",
    emerald: "hover:bg-emerald-500/10 hover:border-emerald-500/50 text-emerald-400",
  };

  return (
    <button
      onClick={() => onClick(op)}
      className={`flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-slate-900/50 backdrop-blur-sm transition-all duration-200 group active:scale-95 ${themes[theme]}`}
    >
      <Icon className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
      <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-300">{op}</span>
      <span className="text-[8px] text-slate-500 font-medium">{label}</span>
    </button>
  );
};

export default function App() {
  const engineRef = useRef(new Tier5Engine());
  const [state, setState] = useState(engineRef.current.state);
  const [position, setPosition] = useState(engineRef.current.position);
  const [quaternion, setQuaternion] = useState(engineRef.current.quaternion);
  const [scale, setScale] = useState(engineRef.current.scale);
  const [mu, setMu] = useState(0);
  const [momentum, setMomentum] = useState(0);
  const [buildStatus, setBuildStatus] = useState<BuildStatus>("success");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // --- Main Loop ---
  useEffect(() => {
    const timer = setInterval(() => {
      const e = engineRef.current;
      e.tick(buildStatus);
      setState({ ...e.state });
      setPosition({ ...e.position });
      setQuaternion({ ...e.quaternion });
      setScale({ ...e.scale });
      setMu(e.mu);
      setMomentum(e.momentum);
    }, 100);
    return () => clearInterval(timer);
  }, [buildStatus]);

  const handleOp = (op: OperatorType) => {
    engineRef.current.applyOperator(op);
    const logEntry: LogEntry = {
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toLocaleTimeString(),
      type: "op",
      message: `Operator ${op} applied`,
    };
    setLogs(prev => [logEntry, ...prev].slice(0, CONFIG.maxHistory));
  };

  // Dynamic Styles for Glitch effect
  const containerClass = `min-h-screen bg-slate-950 text-slate-300 p-4 md:p-8 font-sans selection:bg-indigo-500/30 transition-all duration-300 ${mu > 1.8 ? 'animate-pulse' : ''}`;

  const muShakeStyle = mu > 1.5 ? {
    transform: `translate(${(Math.random() - 0.5) * mu * 2}px, ${(Math.random() - 0.5) * mu * 2}px)`,
    filter: mu > 2.2 ? 'hue-rotate(90deg)' : 'none'
  } : {};

  return (
    <div className={containerClass}>
      <style>{`
        @keyframes subtle-shake {
          0% { transform: translate(0,0); }
          25% { transform: translate(1px, -1px); }
          50% { transform: translate(-1px, 1px); }
          75% { transform: translate(1px, 1px); }
          100% { transform: translate(0,0); }
        }
        .shake-active { animation: subtle-shake 0.1s infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header Section */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-2xl shadow-indigo-500/5 ${mu > 1.5 ? 'shake-active' : ''}`}>
            <Cpu className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter flex items-center gap-2">
              WORLD ENGINE <span className="text-indigo-500 px-2 py-0.5 bg-indigo-500/10 rounded-lg text-sm border border-indigo-500/20">TIER 5</span>
            </h1>
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-[0.2em]">
              <span>Kinetic State Engine</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span className={momentum > 0.5 ? "text-cyan-400" : ""}>Momentum: {momentum.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setBuildStatus(b => b === 'success' ? 'error' : 'success')}
          className={`group px-4 py-2 rounded-xl border transition-all duration-300 flex items-center gap-3 font-mono text-xs font-bold ${
            buildStatus === 'success'
            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${buildStatus === 'success' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          STATUS: {buildStatus.toUpperCase()}
          <RefreshCw className={`w-3 h-3 transition-transform group-hover:rotate-180`} />
        </button>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left: Transformations Display */}
        <div className="lg:col-span-8 space-y-6">

          {/* Operator Grid */}
          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
            <OpButton op="RB" icon={Layers} label="Refactor" theme="rose" onClick={handleOp} />
            <OpButton op="UP" icon={RefreshCw} label="Update" theme="indigo" onClick={handleOp} />
            <OpButton op="ST" icon={GitCommit} label="Snapshot" theme="emerald" onClick={handleOp} />
            <OpButton op="PRV" icon={AlertCircle} label="Verify" theme="amber" onClick={handleOp} />
            <OpButton op="TRX" icon={Move} label="Transform" theme="indigo" onClick={handleOp} />
            <OpButton op="ROT" icon={RotateCw} label="Rotate" theme="emerald" onClick={handleOp} />
          </div>

          {/* Transformation Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Position Panel */}
            <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md shadow-xl">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Move className="w-4 h-4 text-cyan-400" /> Position (3D)
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center p-2 bg-slate-950/40 rounded-lg">
                  <span className="text-slate-400">X</span>
                  <span className="text-cyan-300 font-semibold">{position.x.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-950/40 rounded-lg">
                  <span className="text-slate-400">Y</span>
                  <span className="text-cyan-300 font-semibold">{position.y.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-950/40 rounded-lg">
                  <span className="text-slate-400">Z</span>
                  <span className="text-cyan-300 font-semibold">{position.z.toFixed(3)}</span>
                </div>
              </div>
            </div>

            {/* Scale Panel */}
            <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md shadow-xl">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-400" /> Scale (3D)
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center p-2 bg-slate-950/40 rounded-lg">
                  <span className="text-slate-400">X</span>
                  <span className="text-violet-300 font-semibold">{scale.x.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-950/40 rounded-lg">
                  <span className="text-slate-400">Y</span>
                  <span className="text-violet-300 font-semibold">{scale.y.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-950/40 rounded-lg">
                  <span className="text-slate-400">Z</span>
                  <span className="text-violet-300 font-semibold">{scale.z.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quaternion Panel */}
          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md shadow-xl">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-orange-400" /> Quaternion Rotation
            </h3>
            <div className="grid grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-950/40 rounded-lg">
                <div className="text-slate-500 mb-1">X</div>
                <div className="text-orange-300 font-semibold">{quaternion.x.toFixed(4)}</div>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg">
                <div className="text-slate-500 mb-1">Y</div>
                <div className="text-orange-300 font-semibold">{quaternion.y.toFixed(4)}</div>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg">
                <div className="text-slate-500 mb-1">Z</div>
                <div className="text-orange-300 font-semibold">{quaternion.z.toFixed(4)}</div>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg">
                <div className="text-slate-500 mb-1">W</div>
                <div className="text-orange-300 font-semibold">{quaternion.w.toFixed(4)}</div>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-slate-500">
              Normalized magnitude: {Math.sqrt(quaternion.x ** 2 + quaternion.y ** 2 + quaternion.z ** 2 + quaternion.w ** 2).toFixed(4)}
            </div>
          </div>
        </div>

        {/* Right: Telemetry */}
        <div className="lg:col-span-4 space-y-6">

          {/* Primary Metrics */}
          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md shadow-xl">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" /> Telemetry Vector
            </h2>

            <div className="space-y-5">
              <MetricBar label="Polarity (p)" value={state.p} min={-1} max={1} color="bg-cyan-400" icon={Zap} />
              <MetricBar label="Intensity (i)" value={state.i} max={3} color="bg-rose-500" icon={TrendingUp} />
              <MetricBar label="Generality (g)" value={state.g} max={3} color="bg-indigo-400" icon={Layers} />
              <MetricBar label="Confidence (c)" value={state.c} color={state.c > 0.6 ? "bg-emerald-400" : "bg-amber-400"} icon={Save} />
              <MetricBar label="Frustration (f)" value={state.f} color="bg-orange-500" icon={Frown} />
            </div>

            <div className="mt-10 pt-6 border-t border-white/5">
              <div className="flex justify-between items-end mb-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">System Burden</span>
                  <span className="text-xs font-bold text-slate-300">Complexity ($\mu$)</span>
                </div>
                <span className={`text-3xl font-black font-mono tracking-tighter ${mu > 1.5 ? 'text-rose-500' : 'text-white'}`}>
                  {mu.toFixed(3)}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${mu > 1.8 ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.min(100, (mu / 2.5) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Console Output */}
          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md shadow-xl h-[340px] flex flex-col">
             <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Kernel Log
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
              {logs.length === 0 && <p className="text-[10px] font-mono text-slate-600 italic">Waiting for operator sequence...</p>}
              {logs.map(log => (
                <div key={log.id} className="font-mono text-[10px] flex gap-3 leading-tight border-b border-white/5 pb-1 animate-in fade-in slide-in-from-left-1 duration-200">
                  <span className="text-slate-600 shrink-0">{log.timestamp.split(' ')[0]}</span>
                  <span className={`break-all ${
                    log.type === 'op' ? 'text-indigo-400' :
                    log.type === 'alert' ? 'text-amber-400' :
                    log.type === 'critical' ? 'text-rose-500 font-bold' : 'text-slate-400'
                  }`}>
                    {log.type === 'critical' ? '!! ' : ''}{log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between gap-4 text-[9px] font-mono text-slate-600 uppercase tracking-widest">
        <div className="flex gap-6">
          <span>Engine: Tier_5_Kinetic</span>
          <span>Status: Synchronized</span>
          <span>Buffer: Optimized</span>
        </div>
        <div className="flex gap-6">
          <span>&copy; World Engine Deterministics</span>
          <span className="flex items-center gap-1"><Wind className="w-3 h-3" /> Adaptive Physics Enabled</span>
        </div>
      </footer>
    </div>
  );
}
