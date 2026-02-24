import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { RollingFrameBench } from "./bench";

export default function PerfHUD() {
  const renderer = useThree((state) => state.gl);
  const bench = useMemo(() => new RollingFrameBench(240), []);
  const [text, setText] = useState("perf...");

  useEffect(() => {
    let raf = 0;

    const loop = () => {
      bench.tick();
      const stats = bench.stats();
      const info = renderer.info;

      setText(
        [
          `FPS: ${stats.fps.toFixed(0)}`,
          `ms avg/p95/p99: ${stats.avgMs.toFixed(1)} / ${stats.p95Ms.toFixed(1)} / ${stats.p99Ms.toFixed(1)}`,
          `draw calls: ${info.render.calls}`,
          `triangles: ${info.render.triangles}`,
          `geometries: ${info.memory.geometries}`,
          `textures: ${info.memory.textures}`,
        ].join("\n")
      );

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bench, renderer]);

  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        top: 12,
        zIndex: 50,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.55)",
        color: "white",
        whiteSpace: "pre",
        fontSize: 12,
        lineHeight: 1.35,
        border: "1px solid rgba(255,255,255,0.15)",
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
}
