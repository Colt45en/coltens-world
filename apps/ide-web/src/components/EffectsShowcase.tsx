import React, { useMemo } from "react";
import { AnimatedContent, Dock, ElectricBorder, Galaxy } from "./effects";

export default function EffectsShowcase() {
  const items = useMemo(
    () => [
      { icon: "🏠", label: "Home", onClick: () => console.log("Home") },
      { icon: "🧠", label: "Brain", onClick: () => console.log("Brain") },
      { icon: "🧰", label: "Tools", onClick: () => console.log("Tools") },
      { icon: "⚙️", label: "Settings", onClick: () => console.log("Settings") },
    ],
    [],
  );

  return (
    <div style={{ minHeight: "140vh", background: "#0a0e15", color: "#e8eef6" }}>
      <div style={{ height: "70vh" }}>
        <Galaxy glowIntensity={0.55} rotationSpeed={0.22} density={0.7} />
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 16px 120px" }}>
        <h1 style={{ margin: "6px 0 18px", fontSize: 36, letterSpacing: -0.5 }}>Effects Showcase</h1>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <AnimatedContent key={i} distance={120} threshold={0.12} duration={0.75} ease="power3.out">
              <ElectricBorder color={i % 2 === 0 ? "#00d9ff" : "#ff4fd8"} thickness={2} chaos={0.9} speed={1.05}>
                <div
                  style={{
                    padding: 18,
                    borderRadius: 16,
                    background: "rgba(15, 20, 32, 0.7)",
                    border: "1px solid rgba(100, 160, 255, 0.12)",
                  }}
                >
                  <div style={{ fontSize: 13, opacity: 0.85 }}>Module {i + 1}</div>
                  <div style={{ fontSize: 18, marginTop: 6, fontWeight: 600 }}>Scroll-reveal Card</div>
                  <p style={{ marginTop: 8, opacity: 0.8, lineHeight: 1.5 }}>
                    ElectricBorder + AnimatedContent: safe cleanup, no ID collisions, no CSS forgetting.
                  </p>
                </div>
              </ElectricBorder>
            </AnimatedContent>
          ))}
        </div>
      </div>

      <Dock items={items} magnification={72} baseItemSize={52} />
    </div>
  );
}
