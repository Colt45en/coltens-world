import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite config for IDE Web (engine-grade, deterministic build)
 *
 * Principles:
 * - Reproducible builds (sorted imports, deterministic sourcemaps)
 * - Strict TypeScript checking (enforced upstream via typecheck script)
 * - Contract package integration (@we/contracts for API types)
 * - Optimized for dev (hot reload) and prod (minified, tree-shaken)
 */
export default defineConfig({
  // Alias for contract package
  resolve: {
    dedupe: ["react", "react-dom", "three", "@react-three/fiber", "@react-three/drei"],
    alias: {
      // "@we/contracts": path.resolve(__dirname, "../../packages/contracts"),
      "@world-engine/flowstate": path.resolve(__dirname, "../../packages/flowstate/src/index.ts"),
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      "three",
    ],
    exclude: [
      "three/examples/jsm/utils/SkeletonUtils",
    ],
    esbuildOptions: {
      target: "esnext",
    },
  },

  // Development server
  server: {
    host: '0.0.0.0', // Listen on all interfaces (IPv4 and IPv6)
    port: 5173,
    strictPort: true,
  },

  // Production build (reproducible, deterministic)
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Deterministic sourcemaps
    sourcemap: "hidden",
    // Minify aggressively but reproducibly
    minify: "terser",
    terserOptions: {
      compress: { passes: 3 },
      mangle: true,
      output: {
        // Deterministic output: consistent character case, spacing
        comments: false,
        beautify: false,
      },
    },
    // Reproducible chunk splitting
    rollupOptions: {
      output: {},
    },
  },

  // Plugins
  plugins: [react()],
});
