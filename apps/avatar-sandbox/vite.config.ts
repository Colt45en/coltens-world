import { defineConfig } from "vite";

export default defineConfig({
  plugins: [],
  server: {
    port: 5172,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    minify: "terser",
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  optimizeDeps: {
    exclude: ["@world-engine/wegc-geometry"],
  },
});
