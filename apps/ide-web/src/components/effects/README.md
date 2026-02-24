# Effects Kit (World Engine compatible)

A production-safe effects bundle for React 18 + TypeScript:
- GSAP ScrollTrigger reveal wrappers
- SVG turbulent electric borders
- Spring magnification dock (Motion for React)
- OGL shader-based galaxy canvas

## Install

```bash
pnpm add gsap motion ogl
# or npm i gsap motion ogl
```

> Motion for React is installed as `motion`, imported from `"motion/react"`.

## Usage

```tsx
import { AnimatedContent, ElectricBorder, Dock, Galaxy } from "@/components/effects";

export default function Page() {
  return (
    <div>
      <div style={{ height: 480 }}>
        <Galaxy />
      </div>

      <AnimatedContent distance={120} threshold={0.12}>
        <ElectricBorder color="#00d9ff" thickness={2}>
          <div style={{ padding: 24 }}>
            <h2>Scroll reveal</h2>
          </div>
        </ElectricBorder>
      </AnimatedContent>

      <Dock
        items={[
          { icon: "🏠", label: "Home", onClick: () => console.log("home") },
          { icon: "📚", label: "Docs", onClick: () => console.log("docs") },
        ]}
      />
    </div>
  );
}
```

## Notes

- AnimatedContent is React 18 StrictMode-safe (scoped `gsap.context + revert`)
- ElectricBorder imports its own CSS so you can’t forget the stylesheet
- Dock magnification is computed from pointer distance to each button’s center
- Galaxy uses OGL full-screen triangle shader with responsive resize + best-effort context release
