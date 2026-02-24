import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import "./ElectricBorder.css";

export type ElectricBorderProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  speed?: number;
  chaos?: number;
  thickness?: number;
  radius?: number;
  distortionScale?: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function ElectricBorder({
  children,
  className,
  style,
  color = "#00d9ff",
  speed = 1,
  chaos = 0.85,
  thickness = 2,
  radius = 16,
  distortionScale,
}: ElectricBorderProps) {
  const id = useId().replace(/:/g, "");
  const filterId = `we-electric-filter-${id}`;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setSize({ w: Math.max(0, r.width), h: Math.max(0, r.height) });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const safeSpeed = Math.max(0.05, speed);
  const safeChaos = clamp(chaos, 0, 2);
  const safeThickness = Math.max(1, thickness);

  const baseFreq = useMemo(() => {
    const minDim = Math.max(120, Math.min(size.w || 0, size.h || 0));
    const f = 0.018 * (240 / minDim);
    const fx = clamp(f * (1 + safeChaos * 0.8), 0.004, 0.06);
    const fy = clamp(f * (1 + safeChaos * 1.0), 0.004, 0.08);
    return { fx, fy };
  }, [size.w, size.h, safeChaos]);

  const scale = useMemo(() => {
    const minDim = Math.max(120, Math.min(size.w || 0, size.h || 0));
    const auto = clamp((minDim / 260) * (safeChaos * 18 + 6), 6, 48);
    return distortionScale ?? auto;
  }, [size.w, size.h, safeChaos, distortionScale]);

  const dashSpeed = useMemo(() => `${clamp(1.2 / safeSpeed, 0.2, 3.5)}s`, [safeSpeed]);
  const dur = useMemo(() => `${clamp(2.2 / safeSpeed, 0.25, 6)}s`, [safeSpeed]);
  const freqValues = useMemo(() => {
    const a = `${baseFreq.fx.toFixed(4)} ${baseFreq.fy.toFixed(4)}`;
    const b = `${(baseFreq.fx * 1.35).toFixed(4)} ${(baseFreq.fy * 0.75).toFixed(4)}`;
    const c = `${(baseFreq.fx * 0.9).toFixed(4)} ${(baseFreq.fy * 1.2).toFixed(4)}`;
    return `${a};${b};${c};${a}`;
  }, [baseFreq.fx, baseFreq.fy]);

  return (
    <div
      ref={hostRef}
      className={["we-electric", className].filter(Boolean).join(" ")}
      style={
        {
          ...style,
          ["--we-electric-color" as never]: color,
          ["--we-electric-thickness" as never]: `${safeThickness}px`,
          ["--we-electric-radius" as never]: `${radius}px`,
          ["--we-electric-dash-speed" as never]: dashSpeed,
        } as React.CSSProperties
      }
    >
      <svg className="we-electric__defs" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="turbulence"
              baseFrequency={`${baseFreq.fx} ${baseFreq.fy}`}
              numOctaves={2}
              seed={2}
              stitchTiles="stitch"
              result="noise"
            >
              <animate attributeName="baseFrequency" dur={dur} values={freqValues} repeatCount="indefinite" />
            </feTurbulence>

            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={scale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <svg className="we-electric__overlay" width="100%" height="100%" aria-hidden="true">
        <rect
          className="we-electric__stroke"
          x={safeThickness}
          y={safeThickness}
          width={`calc(100% - ${safeThickness * 2}px)`}
          height={`calc(100% - ${safeThickness * 2}px)`}
          rx={radius}
          ry={radius}
          filter={`url(#${filterId})`}
        />
      </svg>

      <div className="we-electric__content">{children}</div>
    </div>
  );
}

export { ElectricBorder };
