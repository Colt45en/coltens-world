import React from "react";
import { cn } from "../lib/cn";

export function GlassPanel(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div className={cn("glass-panel", className)} {...rest} />;
}

export function NeonTitle(
  props: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h1" | "h2" | "h3" },
) {
  const { as = "h1", className, ...rest } = props;
  const Tag = as;
  return (
    <Tag
      className={cn(
        "font-scifi font-black tracking-wider uppercase",
        "bg-gradient-to-r from-[var(--neon-cyan)] to-white bg-clip-text text-transparent",
        className,
      )}
      {...rest}
    />
  );
}

export function NeonButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "cyan" | "ghost" },
) {
  const { variant = "cyan", className, ...rest } = props;

  const base =
    "font-scifi font-bold tracking-widest px-8 py-3 rounded-xl transition-all duration-200 active:scale-95";
  const cyan =
    "bg-[var(--neon-cyan)] text-black hover:bg-white hover:shadow-[0_0_20px_var(--neon-cyan)]";
  const ghost =
    "bg-transparent text-white/80 border border-white/15 hover:border-[var(--neon-cyan)] hover:text-white hover:shadow-[0_0_14px_rgba(0,243,255,0.25)]";

  return <button className={cn(base, variant === "cyan" ? cyan : ghost, className)} {...rest} />;
}

export function GlassCard(
  props: (React.HTMLAttributes<HTMLDivElement> | React.ButtonHTMLAttributes<HTMLButtonElement>) & { onPress?: () => void }
) {
  const { className, onPress, ...rest } = props;

  if (onPress) {
    return (
      <button
        onClick={() => onPress()}
        className={cn(
          "glass-card select-none",
          "flex flex-col items-center justify-center gap-3",
          "aspect-square",
          className,
        )}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      />
    );
  }

  return (
    <div
      className={cn(
        "glass-card select-none",
        "flex flex-col items-center justify-center gap-3",
        "aspect-square",
        className,
      )}
      {...(rest as React.HTMLAttributes<HTMLDivElement>)}
    />
  );
}

export function NeonBrand() {
  return (
    <div className="font-scifi font-black tracking-widest text-white text-xl sm:text-2xl">
      NEON<span className="text-[var(--neon-gold)]">//</span>NEXUS
    </div>
  );
}

export function StatChip(props: {
  label: string;
  value: string;
  accent: "cyan" | "green" | "gold";
}) {
  const accentVar = (() => {
    switch (props.accent) {
      case "cyan":
        return "var(--neon-cyan)";
      case "green":
        return "var(--neon-green)";
      case "gold":
        return "var(--neon-gold)";
      default:
        throw new Error(`Invalid accent: ${props.accent}`);
    }
  })();

  return (
    <div className="glass-panel rounded-xl p-4" style={{ borderLeft: `2px solid ${accentVar}` }}>
      {props.label && <div className="text-[10px] text-gray-400 font-scifi tracking-widest">{props.label}</div>}
      {props.value && <div className="font-bold tracking-wider text-sm" style={{ color: accentVar }}>
        {props.value}
      </div>}
    </div>
  );
}
