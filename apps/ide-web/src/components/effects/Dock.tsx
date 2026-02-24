import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Dock.css";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

export type DockItem = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

export type DockProps = {
  items: DockItem[];
  className?: string;
  style?: React.CSSProperties;
  magnification?: number;
  baseItemSize?: number;
  influenceRadius?: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function DockButton({
  item,
  mouseX,
  baseItemSize,
  magnification,
  influenceRadius,
}: {
  item: DockItem;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  baseItemSize: number;
  magnification: number;
  influenceRadius: number;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [centerX, setCenterX] = useState<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setCenterX(r.left + r.width / 2);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const distance = useTransform(mouseX, (x) => Math.abs(x - centerX));
  const rawSize = useTransform(distance, (d) => {
    const t = clamp(1 - d / influenceRadius, 0, 1);
    return baseItemSize + t * (magnification - baseItemSize);
  });
  const size = useSpring(rawSize, { stiffness: 420, damping: 36, mass: 0.6 });

  return (
    <motion.button
      ref={ref}
      type="button"
      className="we-dock__btn"
      disabled={item.disabled}
      onClick={item.onClick}
      style={{
        width: size,
        height: size,
        opacity: item.disabled ? 0.55 : 1,
      }}
    >
      <div className="we-dock__stack">
        <div className="we-dock__icon">{item.icon}</div>
        <div className="we-dock__label">{item.label}</div>
      </div>
    </motion.button>
  );
}

export default function Dock({
  items,
  className,
  style,
  magnification = 70,
  baseItemSize = 50,
  influenceRadius = 160,
}: DockProps) {
  const mouseX = useMotionValue<number>(Number.POSITIVE_INFINITY);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const safeItems = useMemo(() => items ?? [], [items]);

  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const active = document.activeElement as HTMLElement | null;
      if (active && el.contains(active)) active.blur();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      ref={dockRef}
      className={["we-dock", className].filter(Boolean).join(" ")}
      style={style}
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) mouseX.set(t.clientX);
      }}
      onTouchEnd={() => mouseX.set(Number.POSITIVE_INFINITY)}
    >
      {safeItems.map((item, idx) => (
        <DockButton
          key={`${item.label}-${idx}`}
          item={item}
          mouseX={mouseX}
          baseItemSize={baseItemSize}
          magnification={magnification}
          influenceRadius={influenceRadius}
        />
      ))}
    </div>
  );
}

export { Dock };
