import { type ReactNode, useMemo, useState, useEffect } from "react";
import { CyberGrid } from "../fx/CyberGrid";
import { NeonPhysicsCanvas } from "../fx/NeonPhysicsCanvas";
import { cn } from "../lib/cn";
import { SystemStatusBanner } from "../system/SystemStatusBanner";
import { GlassPanel, NeonBrand } from "../ui/neon";
import { usePersistLastRoute } from "../world/usePersistLastRoute";
import { Activity, Settings, Zap } from "lucide-react";
import React from "react";

type NavKey = "home" | "system" | "data" | "store" | "alerts" | "settings";

export function NeonNexusLayout(props: Readonly<{
  children: ReactNode;
  onNav?: (key: NavKey) => void;
  active?: NavKey;
  showFx?: boolean;
  compactMode?: boolean;
}>) {
  const active = props.active ?? "home";
  const onNav = props.onNav ?? (() => {});
  const showFx = props.showFx ?? true;
  const compactMode = props.compactMode ?? false;

  const desktopLinks = useMemo(
    () =>
      [
        { key: "system" as const, label: "SYSTEM", icon: Activity },
        { key: "data" as const, label: "DATA", icon: Zap },
        { key: "store" as const, label: "STORE", icon: Settings },
      ] as const,
    [],
  );

  const [mobileActive, setMobileActive] = useState<NavKey>(active);
  const [performanceMode, setPerformanceMode] = useState(false);

  const setActive = (k: NavKey) => {
    setMobileActive(k);
    onNav(k);
  };

  // Track every navigation
  usePersistLastRoute();

  // Auto-detect performance mode
  useEffect(() => {
    const checkPerformance = () => {
      if (typeof window !== "undefined" && "performance" in window) {
        const memory = (performance as any).memory;
        if (memory && memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
          setPerformanceMode(true);
        }
      }
    };

    checkPerformance();
    const interval = setInterval(checkPerformance, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen">
      {/* System Status Banner */}
      <SystemStatusBanner />

      {/* FX layers - disabled in performance mode */}
      {showFx && !performanceMode && (
        <>
          <NeonPhysicsCanvas />
          <CyberGrid />
        </>
      )}

      {/* Desktop top nav - Enhanced */}
      <div className="hidden sm:block fixed top-0 left-0 right-0 z-50">
        <GlassPanel className="px-8 py-4 border-b-0 border-b-white/10 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <NeonBrand />
            {compactMode && (
              <div className="text-xs text-white/40 font-mono">
                COMPACT MODE
              </div>
            )}
          </div>
          <div className="flex gap-8 text-sm font-bold tracking-widest text-gray-300">
            {desktopLinks.map((l) => {
              const Icon = l.icon;
              return (
                <button
                  key={l.key}
                  onClick={() => onNav(l.key)}
                  className={cn(
                    "transition-colors hover:text-[var(--neon-cyan)] flex items-center gap-2",
                    active === l.key && "text-[var(--neon-cyan)] text-glow-cyan",
                  )}
                >
                  <Icon size={16} />
                  {l.label}
                </button>
              );
            })}
          </div>

          {performanceMode && (
            <div className="text-xs px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-mono">
              PERF MODE
            </div>
          )}
        </GlassPanel>
      </div>

      {/* Mobile header */}
      <header className="sm:hidden pt-8 pb-4 px-6 flex justify-between items-center relative z-10">
        <NeonBrand />
        <div className="w-10 h-10 rounded-full border border-[var(--neon-cyan)] flex items-center justify-center shadow-[0_0_10px_rgba(0,243,255,0.3)]">
          <span className="text-[var(--neon-cyan)] text-xs font-bold">U</span>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 px-4 sm:pt-24 pb-24 sm:pb-10">{props.children}</main>

      {/* Mobile bottom nav */}
      <div className="bottom-nav">
        <NavIcon
          label="HOME"
          active={mobileActive === "home"}
          onClick={() => setActive("home")}
          glyph="⌂"
        />
        <NavIcon
          label="DATA"
          active={mobileActive === "data"}
          onClick={() => setActive("data")}
          glyph="⧉"
        />

        {/* Center action */}
        <div className="w-full h-full flex items-center justify-center">
          <button
            onClick={() => setActive("system")}
            className="w-12 h-12 rounded-full bg-[var(--neon-cyan)] text-black -mt-8 shadow-[0_0_15px_var(--neon-cyan)] border-4 border-[var(--bg-deep)] font-black"
            aria-label="System"
            title="System"
          >
            +
          </button>
        </div>

        <NavIcon
          label="ALERTS"
          active={mobileActive === "alerts"}
          onClick={() => setActive("alerts")}
          glyph="⚑"
        />
        <NavIcon
          label="SET"
          active={mobileActive === "settings"}
          onClick={() => setActive("settings")}
          glyph="⚙"
        />
      </div>
    </div>
  );
}

function NavIcon(props: Readonly<{ label: string; active: boolean; onClick: () => void; glyph: string }>) {
  return (
    <button
      onClick={props.onClick}
      className={cn(
        "w-full h-full flex flex-col items-center justify-center text-[1.2rem] transition",
        props.active ? "text-[var(--neon-cyan)] text-glow-cyan" : "text-white/50",
      )}
      aria-label={props.label}
      title={props.label}
    >
      <span className="leading-none">{props.glyph}</span>
    </button>
  );
}
