import path from "node:path";
import { defineConfig } from "vite";

/**
 * Vite config for Preview Runtime (engine-grade, deterministic build)
 *
 * Principles:
 * - Reproducible builds (sorted imports, deterministic sourcemaps)
 * - Game engine in iframe sandbox: isolated from IDE Web
 * - Contract package integration (@we/contracts for queries)
 * - Optimized for hot reload during game development
 */
export default defineConfig({
  // Alias for contract package
  resolve: {
    alias: {
      "@we/contracts": path.resolve(__dirname, "../../packages/contracts"),
    },
  },

  // Development server (separate from IDE Web to allow parallel development)
  server: {
    host: '0.0.0.0', // Listen on all interfaces (IPv4 and IPv6)
    port: 5174,
    strictPort: true,
    // Watch for contract changes
    watch: {
      include: ["src/**", "../../packages/contracts/**"],
    },
  },

  // Production build (reproducible, deterministic)
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Deterministic sourcemaps for debugging
    sourcemap: "hidden",
    // Minify aggressively
    minify: "terser",
    terserOptions: {
      compress: { passes: 3 },
      mangle: true,
      output: {
        comments: false,
        beautify: false,
      },
    },
    // Runtime-specific optimizations
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-contracts": ["@we/contracts"],
        },
      },
    },
  },
});
