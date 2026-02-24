import React, { useMemo } from "react";
import { GlassCard, GlassPanel, NeonButton, NeonTitle, StatChip } from "../ui/neon";

type HubTile = {
  key: string;
  label: string;
  icon: string;
  hint: string;
};

export function NeonHub(props: Readonly<{ onEnter?: () => void; onTile?: (key: string) => void }>) {
  const onEnter = props.onEnter ?? (() => {});
  const onTile = props.onTile ?? (() => {});

  const tiles = useMemo<HubTile[]>(
    () => [
      { key: "system", label: "SYSTEM", icon: "⚙", hint: "Core runtime + config" },
      { key: "menu", label: "MENU", icon: "≡", hint: "Commands + routes" },
      { key: "alerts", label: "ALERTS", icon: "⚑", hint: "Warnings + signal feed" },
      { key: "market", label: "MARKET", icon: "⌬", hint: "Assets + modules" },
      { key: "comm", label: "COMM", icon: "✦", hint: "Presence + channels" },
    ],
    [],
  );

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Hero */}
      <div className="text-center mb-10 mt-4 max-w-2xl">
        <NeonTitle as="h1" className="text-4xl sm:text-6xl">
          Digital Reality
        </NeonTitle>
        <p className="text-gray-400 font-medium tracking-wide text-sm sm:text-lg mt-3 px-4">
          Enter the vortex of infinite data streams.{" "}
          <span className="hidden sm:inline">Touch interface enabled.</span>
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <NeonButton onClick={onEnter}>INITIATE</NeonButton>
          <NeonButton variant="ghost" onClick={() => onTile("docs")}>
            DOCS
          </NeonButton>
        </div>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-8 w-full max-w-5xl px-2">
        {tiles.map((t) => (
          <GlassCard key={t.key} onPress={() => onTile(t.key)}>
            <div className="text-4xl drop-shadow-[0_0_10px_rgba(0,243,255,0.35)]">{t.icon}</div>
            <div className="font-scifi text-xs tracking-widest text-white/80">{t.label}</div>
            <div className="text-[11px] text-white/45 px-3 text-center">{t.hint}</div>
          </GlassCard>
        ))}
      </div>

      {/* Mobile stats */}
      <div className="mt-12 w-full max-w-5xl grid grid-cols-2 gap-4 px-2 sm:hidden">
        <StatChip label="SERVER STATUS" value="ONLINE" accent="green" />
        <StatChip label="USERS" value="8,402" accent="cyan" />
      </div>

      {/* Optional "system strip" for desktop */}
      <div className="hidden sm:block w-full max-w-5xl mt-12 px-2">
        <GlassPanel className="rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="font-scifi tracking-widest text-xs text-white/60">WORLD ENGINE</div>
            <div className="font-bold tracking-wide text-white/90 mt-1">
              Neon Nexus Theme • Glass UI • Physics FX • Mobile Nav
            </div>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded-full text-xs border border-white/15 text-white/70">
              UI: READY
            </span>
            <span className="px-3 py-1 rounded-full text-xs border border-white/15 text-white/70">
              FX: ACTIVE
            </span>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
