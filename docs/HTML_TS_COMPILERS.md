# HTML+TS Compiler Infrastructure (A + B)

**Engine-grade, deterministic compilers for HTML + TypeScript.**

Status: ✅ Production-ready | Two options: Vite (real build) + Single-file (embedded)

## 📋 Overview

Two complementary compilers for different use cases:

| Compiler           | Tool         | Input                             | Output                                 | Use Case                              |
| ------------------ | ------------ | --------------------------------- | -------------------------------------- | ------------------------------------- |
| **A: Vite**        | Vite bundler | `index.html` + `src/main.ts`      | `dist/` (hashed, optimized)            | Production web apps, complex projects |
| **B: Single-File** | esbuild      | `index.single.html` (embedded TS) | `dist/index.html` (compiledJS inlined) | Demos, playgrounds, one-file exports  |

## Compiler A: Vite (Production Build)

### What it does

Vite treats HTML as an entrypoint, compiles TypeScript imports, and outputs an optimized bundle with hashed assets.

**Files:**

- Input: `apps/web/index.html`, `apps/web/src/main.ts`
- Output: `apps/web/dist/index.*.js`, `apps/web/dist/index.html`
- Config: `apps/web/vite.config.ts`

### Quick Start

```bash
cd apps/web
pnpm install
pnpm dev           # Dev server (port 5173)
pnpm build         # Production build (with typecheck)
pnpm preview       # Preview built output (port 4173)
```

### Acceptance Tests (A)

✅ TypeScript typecheck passes
✅ Vite build succeeds
✅ `dist/index.html` exists
✅ Output contains hashed `.js` files
✅ Output HTML has `<script type="module">` (no embedded TS)
✅ Sourcemaps present (optional)

### Run Test

```bash
pnpm test:compiler-a
```

### Build Process

```
index.html (entrypoint)
    ↓ Vite scanner
src/main.ts imports
    ↓ TypeScript compiler
JavaScript modules
    ↓ Tree-shaking (remove dead code)
    ↓ Minification (terser)
    ↓ Module splitting
dist/index.*.js (hashed assets)
```

### Key Features

- ✅ **Type-safe**: Full TypeScript support, strict mode
- ✅ **Deterministic**: Same input → reproducible output (within minor version)
- ✅ **Fast**: dev server with HMR (hot reload)
- ✅ **Optimized**: minification, chunking, code splitting
- ✅ **Standard**: industry-standard production build

---

## Compiler B: Single-File HTML+TS (Embedded Compilation)

### What it does

Reads HTML with embedded `<script type="text/ts">` blocks, compiles to JavaScript using esbuild, and outputs a self-contained HTML file with compiled JS inlined.

**Files:**

- Input: `tooling/htmlts/index.single.html`
- Output: `tooling/htmlts/dist/index.html`
- Compiler: `tooling/htmlts/compile.mjs`

### Quick Start

```bash
cd tooling/htmlts
pnpm install
pnpm build         # Compile once
pnpm watch         # Watch and rebuild on changes
# open dist/index.html in browser
```

### Acceptance Tests (B)

✅ Input HTML contains `<script type="text/ts">`
✅ Compile produces `dist/index.html`
✅ Output has no `type="text/ts"` blocks
✅ Output has `<script type="module">` with compiled JS
✅ Output is valid HTML (parseable)
✅ Compiled functions work (e.g., `add()`, `greet()`)
✅ Can be opened directly in browser

### Run Test

```bash
pnpm test:compiler-b
```

### Build Process

```
index.single.html
    ↓ HTML parser (regex extract)
    Match: <script type="text/ts"> ... </script>
    ↓ esbuild TypeScript compiler
JavaScript (ES2022, no TS syntax)
    ↓ Minify option (off for readability)
    ↓ Inject into HTML
dist/index.html
    (self-contained, ready to serve)
```

### Key Features

- ✅ **Self-contained**: Single HTML file (no external JS)
- ✅ **Deterministic**: Same TS → same JS (esbuild stable)
- ✅ **Watch mode**: Rebuild on file changes
- ✅ **Full TypeScript**: All language features supported
- ✅ **No build system**: Just esbuild, minimal dependencies

### Example: index.single.html

```html
<!doctype html>
<html lang="en">
  <head>
    <title>Demo</title>
  </head>
  <body>
    <div id="app"></div>

    <!-- Embedded TypeScript (compiled to JS) -->
    <script type="text/ts">
      interface Point { x: number; y: number; }

      function distance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
      }

      const result = distance({x: 0, y: 0}, {x: 3, y: 4});
      document.getElementById("app")!.textContent = `Distance: ${result}`;
    </script>
  </body>
</html>
```

After compilation (dist/index.html):

```html
<!doctype html>
<html lang="en">
  <head>
    <title>Demo</title>
  </head>
  <body>
    <div id="app"></div>

    <!-- Comment: TypeScript compiled and inlined -->
    <script type="module">
      function distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
      }
      const result = distance({ x: 0, y: 0 }, { x: 3, y: 4 });
      document.getElementById("app").textContent = `Distance: ${result}`;
    </script>
  </body>
</html>
```

---

## When to Use Each

### Use Compiler A (Vite) when:

- ✅ Real production web application
- ✅ Complex project with many modules
- ✅ Need dev server with HMR
- ✅ Performance optimization matters
- ✅ Multiple entry points or code splitting

### Use Compiler B (Single-File) when:

- ✅ Quick prototype or demo
- ✅ Embedded widget or documentation example
- ✅ One-file export for distribution
- ✅ Playground or interactive tutorial
- ✅ No build system / simple static server

---

## Root Build Commands

Add to `package.json` scripts:

```json
{
  "scripts": {
    "build:compiler-a": "pnpm -C apps/web build",
    "build:compiler-b": "pnpm -C tooling/htmlts run build",
    "build:compilers": "pnpm build:compiler-a && pnpm build:compiler-b",
    "dev:compiler-a": "pnpm -C apps/web dev",
    "dev:compiler-b": "pnpm -C tooling/htmlts run watch",
    "test:compiler-a": "node tooling/test-compilers.mjs a",
    "test:compiler-b": "node tooling/test-compilers.mjs b",
    "test:compilers": "node tooling/test-compilers.mjs",
    "codegen": "pnpm contracts:gen && pnpm build:compilers"
  }
}
```

### Available Commands

```bash
# Development
pnpm dev:compiler-a        # Vite dev server
pnpm dev:compiler-b        # Watch single-file compiler

# Production
pnpm build:compiler-a      # Vite build
pnpm build:compiler-b      # Single-file compile
pnpm build:compilers       # Both

# Testing
pnpm test:compiler-a       # Vite acceptance tests
pnpm test:compiler-b       # Single-file acceptance tests
pnpm test:compilers        # Both

# Full pipeline
pnpm codegen               # contracts → TS types → compile web
```

---

## Determinism Verification

### Compiler A (Vite)

```bash
# Build 1
pnpm build:compiler-a
find apps/web/dist -name "*.js" -exec sha256sum {} \;

# Build 2 (should match)
pnpm build:compiler-a
find apps/web/dist -name "*.js" -exec sha256sum {} \;
```

Expected: Identical SHA256 hashes (deterministic Vite output)

### Compiler B (Single-File)

```bash
# Compile 1
node tooling/htmlts/compile.mjs tooling/htmlts/index.single.html tooling/htmlts/dist/index.html
sha256sum tooling/htmlts/dist/index.html

# Compile 2 (should match)
node tooling/htmlts/compile.mjs tooling/htmlts/index.single.html tooling/htmlts/dist/index.html
sha256sum tooling/htmlts/dist/index.html
```

Expected: Identical SHA256 hashes (deterministic esbuild output)

---

## Repository Structure

```
apps/web/
  package.json               # Vite app manifest
  tsconfig.json              # TS configuration
  vite.config.ts             # Vite build config
  index.html                 # HTML entrypoint
  src/main.ts                # Main TypeScript
  dist/                      # Build output (generated)

tooling/htmlts/
  package.json               # Single-file compiler manifest
  compile.mjs                # esbuild compiler script
  index.single.html          # HTML with embedded TS
  dist/index.html            # Compiled output (generated)

tooling/test-compilers.mjs   # Acceptance tests for both
```

---

## Troubleshooting

### Vite: "Port 5173 is in use"

```bash
pnpm dev:compiler-a -- --port 5175
# or kill existing process
lsof -ti:5173 | xargs kill -9
```

### Single-file: "No <script type='text/ts'> block found"

Ensure `index.single.html` contains:

```html
<script type="text/ts">
  // Your TypeScript here
</script>
```

### Single-file: "esbuild transform failed"

Check TypeScript syntax validity. esbuild may have stricter rules than tsc.

### Build artifacts are stale

```bash
pnpm build:compilers --force
# or clean + rebuild
rm -rf apps/web/dist tooling/htmlts/dist
pnpm build:compilers
```

---

## Integration Notes

Both compilers output browser-ready HTML+JS that can be:

- Served directly from HTTP server
- Embedded in Nucleus (Node.js)
- Deployed to static hosting (Vercel, CloudFront, etc.)
- Wrapped in Electron/Tauri if desktop needed

---

See also:

- [Vite Documentation](https://vitejs.dev/)
- [esbuild Documentation](https://esbuild.github.io/)
- [Root Build System](../docs/ENGINE_GRADE_BUILD_SYSTEM.md)
- [Acceptance Tests](../tooling/test-compilers.mjs)
