import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  plugins: [],
  server: {
    port: 5172,
    open: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: "terser",
  },
  resolve: {
    alias: {
      "@": "/src",
      "@world-engine/wegc-geometry": fileURLToPath(
        new URL("../../packages/wegc-geometry/src/index.ts", import.meta.url)
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@world-engine/wegc-geometry"],
  },
});
