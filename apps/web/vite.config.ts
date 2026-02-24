import { defineConfig } from "vite";

/**
 * Vite HTML+TS compiler (CLI production build)
 *
 * - index.html is the entrypoint
 * - Compiles src/main.ts → js bundle
 * - Outputs dist/ with hashed assets
 * - Deterministic build (reproducible)
 */
export default defineConfig({
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: true,
    },
});
