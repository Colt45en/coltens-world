# Production Hardening: HTML+TS Compilers & Contract Infrastructure

**Status**: Ready for Implementation
**Date**: February 12, 2026
**Scope**: Security, Performance, Reliability, Monitoring

---

## Overview

This document outlines production hardening requirements for:

1. **Compiler A (Vite)** — Web build pipeline
2. **Compiler B (esbuild)** — Single-file compiler
3. **Contract Infrastructure** — Type-safe API client
4. **Deployment & Monitoring** — Production observability

All measures are **production-grade** enterprise standards.

---

## Phase 1: Security Hardening

### 1.1 Dependency Audit & Lock

#### Compiler A (Vite)

```bash
# Check for known vulnerabilities
cd apps/web
pnpm audit

# Security options in vite.config.ts:
```

**Implementation**: Add to `apps/web/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; // if using React

export default defineConfig({
  plugins: [react()],

  // Security headers for dev server
  server: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    },
  },

  // Build optimization
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs in production
        drop_debugger: true,
      },
    },
    sourcemap: "hidden", // Include sourcemaps but exclude from bundle
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500, // Warn on large chunks
    rollupOptions: {
      output: {
        // Separate vendor chunks
        manualChunks: {
          vendor: ["react", "react-dom"], // if using
        },
      },
    },
  },
});
```

#### Compiler B (esbuild)

**Implementation**: Update `tooling/htmlts/compile.mjs`:

```javascript
async function compileOnce(inFile, outFile) {
  // ... existing code ...

  const result = await esbuild.transform(ts, {
    loader: "ts",
    format: "esm",
    target: "es2022",
    sourcemap: false,
    legalComments: "none",
    // Security options:
    minify: true, // Minify output in production
    logLevel: "error", // Don't log warnings in prod
    treeShaking: true, // Remove dead code
    pure: ["console.log", "console.warn"], // Mark as side-effect free
  });

  // ... rest of code ...
}
```

#### pnpm Lock Verification

```bash
# Root workspace
pnpm install --frozen-lockfile

# This ensures production uses exact versions from lock file
# CI/CD should always use --frozen-lockfile
```

**Add to root `package.json` scripts**:

```json
{
  "scripts": {
    "audit": "pnpm -r --if-present run audit",
    "audit:lock": "pnpm install --frozen-lockfile --dry-run",
    "security:check": "pnpm audit && pnpm audit:lock"
  }
}
```

### 1.2 Code Injection Prevention

#### TypeScript Strict Mode (Compiler A)

**Ensure in `apps/web/tsconfig.json`**:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

#### Template Sanitization (Compiler B)

**Update `tooling/htmlts/index.single.html` example**:

```html
<script type="text/ts">
  // SECURITY: Never use innerHTML with user input
  // Use textContent instead
  document.getElementById("app")!.textContent = userInput; // ✓ Safe

  // NOT:
  // document.getElementById("app")!.innerHTML = userInput; // ✗ XSS risk

  // OR use DOMPurify if HTML needed
  import DOMPurify from "dompurify";
  document.getElementById("app")!.innerHTML = DOMPurify.sanitize(userInput);
</script>
```

**Add DOMPurify to `tooling/htmlts/package.json`** (if needed):

```json
{
  "dependencies": {
    "esbuild": "^0.25.0",
    "dompurify": "^3.0.6"
  }
}
```

### 1.3 Supply Chain Security

#### Software Composition Analysis

```bash
# Root workspace - analyze all dependencies
pnpm list --depth=10 > DEPENDENCIES.txt

# Or use SBOM tools (Software Bill of Materials)
npm install -g @cyclonedx/npm
cyclonedx-npm --output-file sbom.xml
```

#### Dependency Version Constraints

**Ensure all critical deps use best practices**:

| Package    | Current | Constraint     | Reason               |
| ---------- | ------- | -------------- | -------------------- |
| esbuild    | ^0.25.0 | >=0.25.0,<0.26 | Deterministic builds |
| vite       | ^5.4.8  | >=5.4.8,<6     | API stability        |
| typescript | ^5.6.3  | >=5.6.3,<6     | Type safety          |

**Implementation**: `tooling/htmlts/package.json`:

```json
{
  "dependencies": {
    "esbuild": ">=0.25.0,<0.26"
  }
}
```

---

## Phase 2: Performance Hardening

### 2.1 Build Caching

#### Compiler A (Vite)

**Add to `apps/web/vite.config.ts`**:

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Cache configuration
    emptyOutDir: false, // Preserve cache between builds

    // Source map caching
    sourceMap: "hidden",

    // Rollup cache
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "chunks/[name]-[hash].js",
        entryFileNames: "[name]-[hash].js",
      },
    },
  },
});
```

#### Compiler B (esbuild) — Incremental

**Create `tooling/htmlts/cache.mjs`**:

```javascript
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Check if output needs rebuilding
 * Returns true if input changed or output missing
 */
export function needsRebuild(inputPath, outputPath) {
  // Read input file
  if (!fs.existsSync(inputPath)) return true;
  const inputContent = fs.readFileSync(inputPath, "utf8");
  const inputHash = crypto.createHash("sha256").update(inputContent).digest("hex");

  // Read output and its metadata
  if (!fs.existsSync(outputPath)) return true;
  const metaPath = outputPath + ".meta";

  if (!fs.existsSync(metaPath)) return true;
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

  // Compare hashes
  return meta.inputHash !== inputHash;
}

/**
 * Save build metadata
 */
export function saveMeta(inputPath, outputPath) {
  const inputContent = fs.readFileSync(inputPath, "utf8");
  const inputHash = crypto.createHash("sha256").update(inputContent).digest("hex");

  const meta = {
    inputHash,
    timestamp: Date.now(),
    version: "1.0",
  };

  fs.writeFileSync(outputPath + ".meta", JSON.stringify(meta, null, 2), "utf8");
}
```

**Update `tooling/htmlts/compile.mjs`** to use caching:

```javascript
import { needsRebuild, saveMeta } from "./cache.mjs";

async function compileOnce(inFile, outFile) {
  // Check if rebuild needed
  if (!needsRebuild(inFile, outFile)) {
    log("cyan", "⚡", `Cache hit: ${outFile} is up-to-date`);
    return;
  }

  // ... existing compilation code ...

  // Save metadata after successful build
  saveMeta(inFile, outFile);
  log("green", "✅", `Built ${path.relative(process.cwd(), outFile)}`);
}
```

### 2.2 Output Size Optimization

#### Compiler A Metrics

**Add to `apps/web/vite.config.ts`**:

```typescript
export default defineConfig({
  build: {
    reportCompressedSize: true,
    chunkSizeWarningLimit: 250, // Warn on chunks >250KB gzipped

    rollupOptions: {
      output: {
        // Chunk size optimization
        manualChunks(id) {
          // Separate vendor chunks
          if (id.includes("node_modules")) {
            if (id.includes("react")) return "vendor-react";
            if (id.includes("lodash")) return "vendor-lodash";
            return "vendor-common";
          }
          return undefined;
        },
      },
    },
  },
});
```

#### Compiler B Size Monitoring

**Update compile script**:

```javascript
async function compileOnce(inFile, outFile) {
  // ... compilation ...

  // Monitor output size
  const stats = fs.statSync(outFile);
  const sizeKb = (stats.size / 1024).toFixed(2);

  if (stats.size > 500 * 1024) {
    // 500KB warning
    log("yellow", "⚠", `Large output: ${sizeKb}KB`);
  } else {
    log("green", "✅", `Output: ${sizeKb}KB`);
  }
}
```

### 2.3 Tree Shaking & Dead Code Elimination

**Ensure esbuild properly handles**:

```javascript
// In compile.mjs
const result = await esbuild.transform(ts, {
  // ... other options ...
  treeShaking: true,
  // Mark side-effect free
  pure: ["console.log", "console.warn", "console.error", "console.info", "console.debug"],
});
```

---

## Phase 3: Reliability Hardening

### 3.1 Error Handling & Recovery

#### Compiler A (Vite)

**Add error middleware in dev server** (`apps/web/vite.config.ts`):

```typescript
export default defineConfig({
  server: {
    middlewareMode: false,

    // Error handling for dev server
    onError: (error) => {
      console.error("Server error:", error);
      // Could integrate with error reporting service
    },
  },
});
```

#### Compiler B Error Resilience

**Update `tooling/htmlts/compile.mjs`**:

```javascript
async function compileOnce(inFile, outFile) {
  try {
    // ... existing code ...

    // Validate output is valid HTML
    const injected = `${htmlNoTs}\n<script type="module">\n${result.code}\n</script>\n`;

    // Parse to verify valid HTML
    if (!isValidHtml(injected)) {
      throw new Error("Generated invalid HTML");
    }

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, injected, "utf8");
  } catch (e) {
    // Create error report
    fs.writeFileSync(
      outFile + ".error",
      `${new Date().toISOString()}: ${e.message}\n${e.stack}`,
      "utf8",
    );
    throw e;
  }
}

function isValidHtml(html) {
  try {
    // Basic validation: check for required structure
    return (
      html.includes("<!doctype") && html.includes("</html>") && !html.includes('type="text/ts"')
    );
  } catch {
    return false;
  }
}
```

### 3.2 Graceful Degradation

#### Compiler A Fallback

In case Vite build fails, provide fallback:

```bash
# In CI/CD
pnpm build || {
  echo "ERROR: Vite build failed"
  # Could fall back to previous build
  cp -r dist.backup dist
  exit 1
}
```

#### Compiler B Rollback

**Maintain backup of last successful build**:

```javascript
async function compileOnce(inFile, outFile) {
  // Backup previous output
  if (fs.existsSync(outFile)) {
    fs.copyFileSync(outFile, outFile + ".bak");
  }

  try {
    // ... compilation ...
    log("green", "✅", `Built ${outFile}`);
  } catch (e) {
    // Restore from backup on error
    if (fs.existsSync(outFile + ".bak")) {
      fs.copyFileSync(outFile + ".bak", outFile);
      log("yellow", "⚠", `Restored from backup after error: ${e.message}`);
    }
    throw e;
  }
}
```

### 3.3 Timeout Protection

#### Compiler A Build Timeout

```bash
# In CI/CD (bash)
timeout 5m pnpm build || {
  echo "ERROR: Build took too long"
  exit 1
}
```

#### Compiler B Watch Timeout

**Update `tooling/htmlts/compile.mjs`**:

```javascript
async function watchFile(inFile, outFile) {
  let watchTimeout;
  const WATCH_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  const resetTimeout = () => {
    clearTimeout(watchTimeout);
    watchTimeout = setTimeout(() => {
      log("yellow", "⚠", "Watch timed out, exiting");
      process.exit(0);
    }, WATCH_TIMEOUT);
  };

  fs.watch(inFile, { persistent: true }, async (evt, filename) => {
    if (evt !== "change") return;

    resetTimeout(); // Reset on activity

    try {
      await compileOnce(inFile, outFile);
    } catch (e) {
      log("red", "❌", `Build error: ${e?.message ?? e}`);
    }
  });

  resetTimeout(); // Start timer
  await new Promise(() => {}); // Keep alive
}
```

---

## Phase 4: Contract Infrastructure Hardening

### 4.1 Type Safety

#### OpenAPI Schema Validation

**Create `tooling/codegen/validate-schema.mjs`**:

```javascript
import fs from "node:fs";
import Ajv from "ajv";

const ajv = new Ajv();

export function validateOpenAPI(schemaPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

  // Validate OpenAPI 3.0+ structure
  const requiredFields = ["openapi", "info", "paths"];
  for (const field of requiredFields) {
    if (!schema[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate all paths have proper structure
  for (const [path, pathItem] of Object.entries(schema.paths)) {
    for (const method of ["get", "post", "put", "delete", "patch"]) {
      if (pathItem[method]) {
        if (!pathItem[method].responses) {
          throw new Error(`${method} ${path} missing responses`);
        }
      }
    }
  }

  return true;
}
```

**Add to root `package.json`**:

```json
{
  "scripts": {
    "contracts:validate": "node tooling/codegen/validate-schema.mjs packages/contracts/openapi/openapi.json"
  }
}
```

#### TypeScript Type Exports

**Ensure `packages/contracts/ts/index.ts` exports all**:

```typescript
// packages/contracts/ts/index.ts
export type * from "./types";

// Re-export specific components for convenience
export type { Components } from "./types";
export type { Paths } from "./types";
```

### 4.2 Contract Versioning

**Add version metadata** to `packages/contracts/openapi/openapi.json`:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "World Engine API",
    "version": "1.0.0",
    "x-generated": "2026-02-12T00:00:00Z",
    "x-generator-version": "openapi-typescript/6.7.5"
  },
  "paths": {}
}
```

### 4.3 Client Generation Stability

**Ensure reproducible generation**:

```bash
# Root package.json
cd packages/contracts

# Generate and verify
pnpm openapi-typescript openapi/openapi.json -o ts/types.ts

# Git-track the generated file
git add ts/types.ts

# Future runs should produce identical output
pnpm openapi-typescript openapi/openapi.json -o ts/types.ts > /dev/null
if git diff --quiet ts/types.ts; then
  echo "✓ Types generated deterministically"
else
  echo "⚠ Types differ - investigate"
fi
```

---

## Phase 5: Monitoring & Observability

### 5.1 Build Metrics

Create a metrics export for build performance:

**Create `tooling/metrics/collector.mjs`**:

```javascript
import fs from "node:fs";
import path from "node:path";

export class BuildMetricsCollector {
  constructor(name) {
    this.name = name;
    this.metrics = {
      name,
      timestamp: new Date().toISOString(),
      timings: {},
      sizes: {},
      errors: [],
    };
  }

  timingStart(label) {
    this.timings = this.timings || {};
    this.timings[label] = { start: performance.now() };
  }

  timingEnd(label) {
    if (!this.timings[label]) return;
    this.timings[label].duration = performance.now() - this.timings[label].start;
  }

  recordSize(label, bytes) {
    this.metrics.sizes[label] = {
      bytes,
      kb: (bytes / 1024).toFixed(2),
      mb: (bytes / (1024 * 1024)).toFixed(2),
    };
  }

  recordError(message, stack) {
    this.metrics.errors.push({ message, stack, time: Date.now() });
  }

  export(filepath) {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(this.metrics, null, 2), "utf8");
    return this.metrics;
  }
}
```

**Use in compile script**:

```javascript
import { BuildMetricsCollector } from "./tooling/metrics/collector.mjs";

async function compileOnce(inFile, outFile) {
  const metrics = new BuildMetricsCollector("htmlts-compiler");

  metrics.timingStart("total");
  metrics.timingStart("read");
  const html = fs.readFileSync(inFile, "utf8");
  metrics.timingEnd("read");

  // ... compilation ...

  metrics.timingStart("write");
  fs.writeFileSync(outFile, injected, "utf8");
  metrics.timingEnd("write");

  metrics.recordSize("output", fs.statSync(outFile).size);
  metrics.timingEnd("total");

  // Export metrics
  metrics.export(".metrics/htmlts-latest.json");
}
```

### 5.2 Error Tracking

**Integrate with error reporting** (e.g., Sentry):

```javascript
// tooling/errors/reporter.mjs (optional)
export class ErrorReporter {
  constructor(dsn) {
    this.dsn = dsn; // Sentry DSN or similar
  }

  report(error, context = {}) {
    const payload = {
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack,
      context,
    };

    if (this.dsn) {
      // Post to error tracking service
      fetch(this.dsn, {
        method: "POST",
        body: JSON.stringify(payload),
      }).catch(() => {
        // Fail silently in CI
      });
    }

    // Always log locally
    console.error(JSON.stringify(payload));
  }
}
```

### 5.3 Health Checks

**Add periodic health verification**:

```bash
#!/bin/bash
# tooling/health-check.sh

echo "🏥 Health Check: Compilers"

# Check Compiler A can build
cd apps/web
pnpm build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Compiler A: OK"
else
  echo "✗ Compiler A: FAILED"
  exit 1
fi

# Check Compiler B can compile
cd ../../tooling/htmlts
node compile.mjs index.single.html dist/index.html > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Compiler B: OK"
else
  echo "✗ Compiler B: FAILED"
  exit 1
fi

echo "✅ All systems healthy"
```

---

## Phase 6: Deployment Hardening

### 6.1 Container Security (Docker)

**Create `Dockerfile` for compiled output**:

```dockerfile
# Multi-stage build for Compiler A
FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/web .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Minimal runtime image
FROM node:20-alpine
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
USER nextjs

# Serve with http-server
RUN npm install -g http-server
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["http-server", "dist", "-p", "3000", "--cache", "86400"]
```

### 6.2 CI/CD Validation

**Add to CI pipeline** (e.g., GitHub Actions):

```yaml
name: Production Hardening Checks

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Audit dependencies
        run: pnpm audit --audit-level=moderate

      - name: TypeScript check
        run: pnpm typecheck

      - name: Build Compiler A
        run: pnpm build:compiler-a

      - name: Build Compiler B
        run: pnpm build:compiler-b

      - name: Run tests
        run: pnpm test:compilers

      - name: Validate contracts
        run: pnpm contracts:validate
```

### 6.3 Signed Releases

**Create build attestation**:

```bash
#!/bin/bash
# tooling/release/sign-build.sh

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT=$(git rev-parse --short HEAD)
BUILD_ID="build-${COMMIT}-${TIMESTAMP}"

# Create manifest
cat > dist/BUILD_MANIFEST.json <<EOF
{
  "id": "${BUILD_ID}",
  "timestamp": "${TIMESTAMP}",
  "git_commit": "${COMMIT}",
  "node_version": "$(node --version)",
  "pnpm_version": "$(pnpm --version)",
  "artifacts": [
EOF

# Add file hashes
find dist -type f -exec sha256sum {} \; | while read hash file; do
  echo "    {\"path\": \"${file}\", \"sha256\": \"${hash}\"}" >> dist/BUILD_MANIFEST.json
done

echo "  ]" >> dist/BUILD_MANIFEST.json
echo "}" >> dist/BUILD_MANIFEST.json

# Sign (requires gpg key)
if command -v gpg &> /dev/null; then
  gpg --detach-sign --armor dist/BUILD_MANIFEST.json
  echo "✓ Build signed: dist/BUILD_MANIFEST.json.asc"
fi
```

---

## Phase 7: Security Audit Checklist

- [ ] **Dependencies**: All audited, no critical vulnerabilities
- [ ] **Code**: Type-safe TypeScript, no `any` types except justified
- [ ] **Build**: Minified, tree-shaken, sourcemaps hidden
- [ ] **Container**: Non-root user, security headers, distroless image
- [ ] **Monitoring**: Metrics exported, errors tracked, health checked
- [ ] **Docs**: Security guidelines in README, threat model documented
- [ ] **CI/CD**: All checks automated, signed builds, immutable artifacts
- [ ] **Distribution**: Checksums published, versions pinned, reproducible

---

## Implementation Timeline

| Phase          | Priority     | Effort   | Timeline |
| -------------- | ------------ | -------- | -------- |
| 1: Security    | **High**     | 2-3 days | Week 1   |
| 2: Performance | High         | 1-2 days | Week 1   |
| 3: Reliability | High         | 2 days   | Week 1   |
| 4: Contracts   | Medium       | 1 day    | Week 2   |
| 5: Monitoring  | Medium       | 2 days   | Week 2   |
| 6: Deployment  | High         | 3 days   | Week 2   |
| 7: Audit       | **Critical** | 1 day    | Week 3   |

---

## Success Criteria

- ✅ All production hardening phases implemented
- ✅ Security audit passes
- ✅ Dependency audit clean
- ✅ Build metrics under thresholds
- ✅ Error tracking active
- ✅ CI/CD pipeline complete
- ✅ Deployment documentation ready
- ✅ Container images signed

---

See also:

- [INTEGRATION_TESTING_GUIDE.md](./INTEGRATION_TESTING_GUIDE.md) — Testing procedures
- [HTML_TS_COMPILERS.md](./HTML_TS_COMPILERS.md) — Developer reference
- [CONTRACT_INTEGRATION_CHECKLIST.md](./CONTRACT_INTEGRATION_CHECKLIST.md) — Contract setup
