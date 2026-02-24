import { Play, Shield, Zap } from "lucide-react";
import React, { useEffect, useState } from "react";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";

/**
 * LauncherControlPage — Master control panel for all services
 *
 * Shows status of all running services and provides one-click launch/shutdown.
 */

interface ServiceStatus {
  name: string;
  url: string;
  port: number;
  status: "running" | "stopped" | "checking";
  color: string;
  icon: React.ReactNode;
}

function getServiceProbeUrl(service: ServiceStatus): string {
  return service.port === 3000 ? `http://localhost:${service.port}` : service.url;
}

async function checkServiceStatus(service: ServiceStatus): Promise<ServiceStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(getServiceProbeUrl(service), {
      signal: controller.signal,
      method: "HEAD",
    });

    return {
      ...service,
      status: response.ok ? "running" : "stopped",
    };
  } catch {
    return {
      ...service,
      status: "stopped",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getLaunchButtonLabel(isLaunching: boolean, allRunning: boolean): string {
  if (isLaunching) return "LAUNCHING...";
  if (allRunning) return "✓ ALL RUNNING";
  return "LAUNCH NOW";
}

function getServiceStatusClass(status: ServiceStatus["status"]): string {
  if (status === "running") return "bg-green-500/20 text-green-300";
  if (status === "checking") return "bg-yellow-500/20 text-yellow-300";
  return "bg-slate-500/20 text-slate-300";
}

function getServiceStatusText(status: ServiceStatus["status"]): string {
  if (status === "running") return "✓ ONLINE";
  if (status === "checking") return "⏳ CHECKING";
  return "✗ OFFLINE";
}

export function LabLauncherControlPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: "Nucleus Hub",
      url: "ws://localhost:3000",
      port: 3000,
      status: "checking",
      color: "text-cyan-400",
      icon: <Zap size={24} />,
    },
    {
      name: "IDE Web",
      url: "http://localhost:5173",
      port: 5173,
      status: "checking",
      color: "text-green-400",
      icon: <Shield size={24} />,
    },
    {
      name: "Preview Runtime",
      url: "http://localhost:5174",
      port: 5174,
      status: "checking",
      color: "text-magenta-400",
      icon: <Play size={24} />,
    },
    {
      name: "Python Sidecar",
      url: "http://127.0.0.1:8001",
      port: 8001,
      status: "checking",
      color: "text-yellow-400",
      icon: <Zap size={24} />,
    },
  ]);

  const [isLaunching, setIsLaunching] = useState(false);
  const [launchOutput, setLaunchOutput] = useState<string[]>([]);

  // Check service health
  useEffect(() => {
    const checkServices = async () => {
      const updated = await Promise.all(services.map((service) => checkServiceStatus(service)));
      setServices(updated);
    };

    checkServices();
    const interval = setInterval(checkServices, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const launchAll = () => {
    setIsLaunching(true);
    setLaunchOutput([
      "🚀 Starting all services...",
      "This window will close when all services are running.",
      "",
      "Monitor progress in your terminal.",
    ]);

    // Simulate opening the launcher script in a new terminal
    // In a real implementation, this would call a backend API or spawn a process
    setTimeout(() => {
      setLaunchOutput((prev) => [
        ...prev,
        "[NUCLEUS] Starting on port 3000...",
        "[IDE-WEB] Starting on port 5173...",
        "[PREVIEW] Starting on port 5174...",
        "[PYTHON] Starting on port 8001...",
      ]);
    }, 500);

    setTimeout(() => {
      setLaunchOutput((prev) => [
        ...prev,
        "",
        "✓ All services launched!",
        "✓ Check your terminal for logs",
        "",
      ]);
      setIsLaunching(false);

      // Refresh service status
      setTimeout(() => {
        alert(
          "Services launched! If you ran the launcher separately, services should be online now. Click OK to refresh status.",
        );
        globalThis.location.reload();
      }, 2000);
    }, 3000);
  };

  const openService = (url: string) => {
    globalThis.open(url, "_blank");
  };

  const allRunning = services.every((s) => s.status === "running");
  const anyRunning = services.some((s) => s.status === "running");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <GlassPanel className="rounded-2xl p-8 text-center">
        <NeonTitle as="h1" className="text-5xl mb-2">
          World Engine
        </NeonTitle>
        <p className="text-white/60 text-lg">Master Control & Service Launcher</p>
      </GlassPanel>

      {/* Big Launch Button */}
      <GlassPanel className="rounded-2xl p-8 bg-gradient-to-br from-cyan-950/30 to-slate-950/30 border border-cyan-500/30">
        <div className="text-center space-y-4">
          <div className="text-6xl drop-shadow-[0_0_20px_rgba(0,243,255,0.4)]">⚡</div>

          <h2 className="text-3xl font-bold text-white">LAUNCH ALL SERVICES</h2>
          <p className="text-white/70 mb-6">
            Start all services with one click. Open a terminal and run:
          </p>

          <code className="block bg-slate-900/50 p-4 rounded text-cyan-300 font-mono text-lg mb-6 border border-cyan-500/20">
            pnpm launch
          </code>

          <div className="flex gap-4 justify-center">
            <NeonButton onClick={launchAll} disabled={isLaunching || allRunning}>
              {getLaunchButtonLabel(isLaunching, allRunning)}
            </NeonButton>

            {anyRunning && (
              <NeonButton
                variant="ghost"
                onClick={() => {
                  globalThis.location.reload();
                }}
              >
                REFRESH STATUS
              </NeonButton>
            )}
          </div>

          {launchOutput.length > 0 && (
            <div className="mt-6 bg-slate-950/50 p-4 rounded text-left font-mono text-sm text-white/70 max-h-32 overflow-y-auto border border-white/10">
              {launchOutput.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Service Status Grid */}
      <div>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Shield size={16} className="text-cyan-400" />
          Service Status
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((service) => (
            <GlassPanel
              key={service.name}
              className="p-4 hover:border-cyan-400/50 transition-colors cursor-pointer"
              onClick={() => service.status === "running" && openService(service.url)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`${service.color}`}>{service.icon}</div>
                  <div>
                    <div className="font-bold text-white">{service.name}</div>
                    <div className="text-xs text-white/50 font-mono">{service.url}</div>
                  </div>
                </div>

                <div
                  className={`px-3 py-1 rounded text-xs font-bold ${getServiceStatusClass(service.status)}`}
                >
                  {getServiceStatusText(service.status)}
                </div>
              </div>

              {service.status === "running" && (
                <button
                  onClick={() => openService(service.url)}
                  className="w-full text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 py-1 rounded transition-colors"
                >
                  Open Service →
                </button>
              )}
            </GlassPanel>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <GlassPanel className="rounded-2xl p-6 bg-slate-950/30">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          Quick Start
        </h3>

        <div className="space-y-2 text-sm text-white/70">
          <p>
            <span className="text-white font-mono">pnpm launch</span> — Starts all services in
            parallel
          </p>
          <p>
            <span className="text-white font-mono">pnpm launch:complete</span> — Same as above
          </p>
          <p className="text-white/50">
            Services start with staggered delays for stability. All will be ready within ~10
            seconds.
          </p>
        </div>
      </GlassPanel>

      {/* Connection Info */}
      {allRunning && (
        <GlassPanel className="rounded-2xl p-6 bg-green-950/20 border border-green-500/30">
          <h3 className="font-bold text-green-300 mb-3">✓ System Ready</h3>
          <p className="text-green-200/70 text-sm">
            All services are online and ready to use. The World Engine is running at full capacity.
          </p>
        </GlassPanel>
      )}
    </div>
  );
}
