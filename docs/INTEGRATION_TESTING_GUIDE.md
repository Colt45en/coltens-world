# Integration Testing Guide: HTML+TS Compilers + Contract Infrastructure

**Status**: Ready for Manual/Local Testing
**Date**: February 12, 2026
**Environment**: Windows (Note: Terminal tool requires WSL configuration - see [Local Testing](#local-testing))

---

## Overview

This guide covers integration testing for:

1. **Compiler A (Vite)** — Production web build toolchain
2. **Compiler B (Single-File)** — Embedded esbuild for playgrounds
3. **Contract Infrastructure** — Type-safe HTTP client generation

All components are **code-ready**. This document provides step-by-step testing procedures.

---

## Quick Status

| Component            | Status        | Notes                                         |
| -------------------- | ------------- | --------------------------------------------- |
| Compiler A (Vite)    | ✅ Code Ready | `apps/web/` - needs build test                |
| Compiler B (esbuild) | ✅ Code Ready | `tooling/htmlts/` - needs compile test        |
| Test Suite           | ✅ Code Ready | `tooling/test-compilers.mjs` - ready to run   |
| Root Scripts         | ✅ Added      | Package.json updated with compiler commands   |
| Contracts            | ✅ Code Ready | `packages/contracts/` - needs generation test |

---

## Local Testing (Windows PowerShell)

### Prerequisites

```powershell
# Check Node.js (v18+ required)
node --version
npm --version

# Check pnpm (v8+ required)
pnpm --version

# Check Python (3.9+ for py-sidecar)
python --version
```

### Environment Setup

```powershell
# From workspace root
cd 'c:\Users\colte\colten projects\coltens world'

# Install all dependencies (one-time)
pnpm install

# Verify thedist directories don't exist (start fresh)
Remove-Item -Force -Recurse apps/web/dist -ErrorAction Ignore
Remove-Item -Force -Recurse tooling/htmlts/dist -ErrorAction Ignore
```

---

## Test Plan 1: Compiler A (Vite) Integration

### 1.1 Verify TypeScript Configuration

```powershell
cd apps/web

# Check tsconfig.json exists and is valid
Test-Path tsconfig.json
Get-Content tsconfig.json | ConvertFrom-Json
```

**Expected**: File exists, JSON valid, contains `"strict": true`

### 1.2 Check Dependencies

```powershell
# From apps/web
Get-Content package.json | ConvertFrom-Json | Select-Object -ExpandProperty devDependencies |
  ForEach-Object {
    @("vite", "typescript", "@types/node") |
    ForEach-Object {
      if ($_.PSObject.Properties.Name -contains $_) {
        Write-Host "✓ $_"
      }
    }
  }
```

**Expected**: vite, typescript, @types/node present

### 1.3 TypeScript Typecheck

```powershell
cd apps/web
pnpm typecheck
```

**Expected Output**:

```
✓ No errors found
```

**If fails**: Check `src/main.ts` for syntax errors and missing type annotations

### 1.4 Vite Build (Production)

```powershell
cd apps/web
pnpm build
```

**Expected Output**:

```
✓ dist/index.html created
✓ dist/index.*.js created (hashed)
✓ Build completed in Xms
```

**If fails**: Check Vite config in `vite.config.ts`

### 1.5 Verify Build Artifacts

```powershell
cd apps/web

# Check dist folder exists
$distPath = "dist"
if (Test-Path $distPath) {
  Write-Host "✓ dist/ exists"

  # List files
  Get-ChildItem dist -Recurse | ForEach-Object { Write-Host "  - $($_.Name)" }

  # Check for hashed JS
  $jsFiles = Get-ChildItem dist -Filter "*.js" | Measure-Object
  if ($jsFiles.Count -gt 0) {
    Write-Host "✓ Found $($jsFiles.Count) JavaScript files"
  } else {
    Write-Host "✗ No JavaScript files found!"
  }

  # Verify index.html
  $html = Get-Content dist/index.html -Raw
  if ($html -match 'type="module"') {
    Write-Host "✓ index.html contains module scripts"
  }
  if ($html -notmatch 'type="text/ts"') {
    Write-Host "✓ index.html has no embedded TypeScript"
  }
} else {
  Write-Host "✗ dist/ folder not found!"
}
```

**Expected**:

- ✓ dist/ exists
- ✓ index.html found
- ✓ index.\*.js files created (with hashes)
- ✓ Module scripts present
- ✓ No embedded TypeScript

### 1.6 Dev Server Test

```powershell
# From apps/web, start in background
Start-Process -FilePath "pnpm" -ArgumentList "dev" -WindowStyle Minimized

# Wait for server to start
Start-Sleep -Seconds 5

# Test connection
$response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing
if ($response.StatusCode -eq 200) {
  Write-Host "✓ Dev server running on port 5173"
  Write-Host "✓ HTTP 200 OK"
} else {
  Write-Host "✗ Unexpected status: $($response.StatusCode)"
}

# Kill the dev server (find pnpm process)
Get-Process pnpm -ErrorAction Ignore | Stop-Process -Force
```

**Expected**:

- ✓ Server starts on port 5173
- ✓ HTTP 200 response
- ✓ Server stops cleanly

---

## Test Plan 2: Compiler B (Single-File HTML+TS) Integration

### 2.1 Verify Input File

```powershell
cd tooling/htmlts

# Check input exists
Test-Path index.single.html
Get-Item index.single.html | Select-Object -ExpandProperty Length

# Verify it contains TS block
$content = Get-Content index.single.html -Raw
if ($content -match 'type="text/ts"') {
  Write-Host "✓ input has <script type='text/ts'>"
} else {
  Write-Host "✗ Missing TypeScript block!"
}
```

**Expected**:

- ✓ File exists
- ✓ Contains `<script type="text/ts">`

### 2.2 Check Dependencies

```powershell
cd tooling/htmlts

# Verify esbuild installed or installable
$pkg = Get-Content package.json | ConvertFrom-Json
if ($pkg.dependencies.esbuild) {
  Write-Host "✓ esbuild declared in package.json"
  Write-Host "  Version: $($pkg.dependencies.esbuild)"
}

# Install if needed
pnpm install
```

**Expected**:

- ✓ esbuild in dependencies (^0.25.0)
- ✓ pnpm install completes

### 2.3 Single Compilation

```powershell
cd tooling/htmlts

# Compile once
node compile.mjs index.single.html dist/index.html
```

**Expected Output**:

```
📝 Reading index.single.html
🔨 Compiling 1 TypeScript block(s)...
✅ Compiled XXXX bytes of JavaScript
💾 Writing dist/index.html
✅ Built dist/index.html
```

**If fails**:

- Check error message
- Verify TypeScript syntax in index.single.html is valid
- Check esbuild version compatibility

### 2.4 Verify Output

```powershell
cd tooling/htmlts

# Check dist exists
if (Test-Path "dist/index.html") {
  Write-Host "✓ dist/index.html created"

  # Get file size
  $size = (Get-Item dist/index.html).Length
  Write-Host "  Size: $size bytes"

  # Validate HTML
  $html = Get-Content dist/index.html -Raw

  if ($html -match '<!doctype') {
    Write-Host "✓ Valid HTML doctype"
  }

  if ($html -notmatch 'type="text/ts"') {
    Write-Host "✓ No embedded TypeScript remaining"
  }

  if ($html -match 'type="module"') {
    Write-Host "✓ Has module script tags"
  }

  if ($html -match 'function') {
    Write-Host "✓ Contains compiled JavaScript functions"
  }

  if ($html -match 'add|greet') {
    Write-Host "✓ Demo functions present"
  }
} else {
  Write-Host "✗ dist/index.html not created!"
}
```

**Expected**:

- ✓ dist/index.html created
- ✓ Valid HTML (doctype present)
- ✓ No embedded TypeScript
- ✓ Module scripts present
- ✓ Compiled JavaScript present
- ✓ Demo functions in output

### 2.5 Watch Mode Test

```powershell
cd tooling/htmlts

# Clean previous build
Remove-Item dist -Force -Recurse -ErrorAction Ignore

# Start watch in background
$watchProc = Start-Process -FilePath "pnpm" -ArgumentList "run watch" `
  -PassThru -WindowStyle Minimized

# Wait for initial build
Start-Sleep -Seconds 3

if (Test-Path "dist/index.html") {
  Write-Host "✓ Initial build created dist/index.html"
} else {
  Write-Host "✗ Watch mode failed to build!"
  Stop-Process $watchProc -Force
  exit 1
}

# Modify the input file
$html = Get-Content index.single.html -Raw
$modified = $html -replace '// Auto-run on page load', '// Modified for testing' + "`n// Auto-run on page load"
Set-Content index.single.html $modified

# Wait for rebuild
Start-Sleep -Seconds 2

# Check if output was updated
$newHtml = Get-Content dist/index.html -Raw
if ($newHtml -match 'Modified for testing') {
  Write-Host "✓ Watch mode detected change and rebuilt!"
} else {
  Write-Host "⚠ Watch mode may not have detected the change"
}

# Restore original
git checkout index.single.html -q

# Stop watch
Stop-Process $watchProc -Force
Write-Host "✓ Watch mode stopped cleanly"
```

**Expected**:

- ✓ Initial build in <3 seconds
- ✓ Watch mode detects file changes
- ✓ Automatic rebuild triggers
- ✓ Updated output reflects changes

---

## Test Plan 3: Acceptance Test Suite

### 3.1 Run All Tests

```powershell
cd 'c:\Users\colte\colten projects\coltens world'

# Run full test suite
node tooling/test-compilers.mjs
```

**Expected Output**:

```
🧪 HTML+TS Compiler Acceptance Tests

🔨 Testing Compiler A (Vite)...
▸ Test A.1: TypeScript typecheck
✅ TypeScript typecheck passed
...
🔨 Testing Compiler B (Single-file HTML+TS)...
...
✅ All tests passed!
```

### 3.2 Run Individual Tests

```powershell
# Test Compiler A only
node tooling/test-compilers.mjs a

# Test Compiler B only
node tooling/test-compilers.mjs b
```

### 3.3 Interpret Results

| Test                 | Passes                | Fails                                |
| -------------------- | --------------------- | ------------------------------------ |
| TypeScript typecheck | No syntax errors      | Check `src/main.ts`, `tsconfig.json` |
| Build succeeds       | dist/ created         | Check Vite config, plugin conflicts  |
| Output valid         | Module scripts, no TS | Check compiled HTML content          |
| Determinism          | Consistent output     | Rebuild and compare hashes           |

---

## Test Plan 4: Contract Infrastructure Integration

### 4.1 Generate OpenAPI Schema

```powershell
cd 'c:\Users\colte\colten projects\coltens world'

# Export contract schema from Python
python -c "
import sys
sys.path.insert(0, 'apps/py-sidecar')
from app.contracts import generate_openapi_schema

schema = generate_openapi_schema()
print('✓ Generated OpenAPI schema')
print(f'  Paths: {len(schema[\"paths\"])}')
print(f'  Components: {len(schema.get(\"components\", {}).get(\"schemas\", {}))}')
"
```

**Expected**:

- ✓ Schema generated successfully
- ✓ Multiple paths enumerated
- ✓ Component schemas defined

### 4.2 Generate TypeScript Types

```powershell
cd 'c:\Users\colte\colten projects\coltens world'

# Run openapi-typescript
pnpm contracts:ts
```

**Expected Output**:

```
✓ packages/contracts/ts/types.ts created
✓ Exported X type definitions
```

### 4.3 Verify TypeScript Types

```powershell
# Check generated types file
$typeFile = 'packages/contracts/ts/types.ts'
if (Test-Path $typeFile) {
  $content = Get-Content $typeFile
  $lines = @($content).Count

  Write-Host "✓ Generated types file: $lines lines"

  # Check for expected exports
  if ($content -match 'export interface') {
    $interfaces = @($content | Select-String 'export interface' | Measure-Object)
    Write-Host "✓ Found $($interfaces.Count) interfaces"
  }

  if ($content -match 'export type') {
    $types = @($content | Select-String 'export type' | Measure-Object)
    Write-Host "✓ Found $($types.Count) type aliases"
  }
} else {
  Write-Host "✗ Generated types file not found!"
}
```

**Expected**:

- ✓ File created and contains content
- ✓ Multiple exported types/interfaces
- ✓ Valid TypeScript syntax

### 4.4 Use Types in Project

```powershell
# Create a test file that imports the types
$testCode = @'
import type { Components } from "@we/contracts/ts/types";

// This should compile without errors if types are correct
type RequestPayload = Components["schemas"]["autonomy_IngestRequest"];
type ResponsePayload = Components["responses"]["IngestResponse"];

console.log("✓ Contract types imported successfully");
'@

Set-Content tests/contract-types.test.ts $testCode

# TypeScript should compile without errors
pnpm typecheck
```

**Expected**:

- ✓ No TypeScript errors
- ✓ Types properly exported
- ✓ Components accessible

---

## Test Plan 5: Full Integration

### 5.1 Build All Components

```powershell
cd 'c:\Users\colte\colten projects\coltens world'

# Full build including compilers
pnpm build:compilers
```

**Expected**:

- ✓ Compiler A build succeeds
- ✓ Compiler B compilation succeeds
- ✓ Both output directories contain artifacts

### 5.2 Verify Output Artifacts

```powershell
$artifacts = @(
  'apps/web/dist/index.html',
  'apps/web/dist/index.*.js',
  'tooling/htmlts/dist/index.html'
)

foreach ($artifact in $artifacts) {
  $matches = Get-Item $artifact -ErrorAction Ignore
  if ($matches) {
    Write-Host "✓ $artifact"
  } else {
    Write-Host "✗ Missing: $artifact"
  }
}
```

**Expected**: All artifacts present

### 5.3 Combined Determinism Check

```powershell
# Get checksums first build
$checksums1 = @{
  'web' = (Get-ChildItem apps/web/dist -Filter '*.js' |
           ForEach-Object { (Get-FileHash $_ -Algorithm SHA256).Hash } |
           Sort-Object | Out-String)
  'htmlts' = ((Get-FileHash tooling/htmlts/dist/index.html -Algorithm SHA256).Hash)
}

# Clean and rebuild
Remove-Item apps/web/dist, tooling/htmlts/dist -Force -Recurse -ErrorAction Ignore
pnpm build:compilers

# Get checksums second build
$checksums2 = @{
  'web' = (Get-ChildItem apps/web/dist -Filter '*.js' |
           ForEach-Object { (Get-FileHash $_ -Algorithm SHA256).Hash } |
           Sort-Object | Out-String)
  'htmlts' = ((Get-FileHash tooling/htmlts/dist/index.html -Algorithm SHA256).Hash)
}

# Compare
if ($checksums1['web'] -eq $checksums2['web']) {
  Write-Host "✓ Compiler A output is deterministic"
} else {
  Write-Host "⚠ Compiler A output differs between builds"
}

if ($checksums1['htmlts'] -eq $checksums2['htmlts']) {
  Write-Host "✓ Compiler B output is deterministic"
} else {
  Write-Host "⚠ Compiler B output differs between builds"
}
```

**Expected**:

- ✓ Both compilers produce identical output across builds

---

## Test Plan 6: Production Simulation

### 6.1 Static Server Test

```powershell
# Serve Compiler A output
$serverProc = Start-Process -FilePath "python" -ArgumentList "-m http.server 8080 --directory apps/web/dist" `
  -PassThru -WindowStyle Minimized

Start-Sleep -Seconds 2

# Test HTTP requests
try {
  $response = Invoke-WebRequest -Uri "http://localhost:8080/index.html" -UseBasicParsing
  Write-Host "✓ Compiler A output served successfully (HTTP $($response.StatusCode))"
} catch {
  Write-Host "✗ Failed to serve Compiler A: $_"
}

Stop-Process $serverProc -Force

# Serve Compiler B output
$serverProc = Start-Process -FilePath "python" -ArgumentList "-m http.server 8081 --directory tooling/htmlts/dist" `
  -PassThru -WindowStyle Minimized

Start-Sleep -Seconds 2

try {
  $response = Invoke-WebRequest -Uri "http://localhost:8081/index.html" -UseBasicParsing
  Write-Host "✓ Compiler B output served successfully (HTTP $($response.StatusCode))"
} catch {
  Write-Host "✗ Failed to serve Compiler B: $_"
}

Stop-Process $serverProc -Force
```

**Expected**:

- ✓ Compiler A output servable (HTTP 200)
- ✓ Compiler B output servable (HTTP 200)

### 6.2 Dependency Check

```powershell
# Verify no external dependencies in Compiler B output
$htmlContent = Get-Content tooling/htmlts/dist/index.html -Raw

$externalDeps = @(
  'https://',
  'http://',
  'src=',
  'href='
) | ForEach-Object {
  if ($htmlContent -match $_) {
    "✗ Found external reference: $_"
  }
}

if (!$externalDeps) {
  Write-Host "✓ Compiler B output is self-contained (no external resources)"
}
```

**Expected**:

- ✓ No external HTTP/HTTPS dependencies
- ✓ Completely self-contained HTML

---

## Troubleshooting

### Issue: Port Already in Use

```powershell
# Find process on port
netstat -ano | findstr :5173

# Kill by PID (replace XXXX)
taskkill /PID XXXX /F
```

### Issue: esbuild Not Found

```powershell
cd tooling/htmlts

# Reinstall dependencies
Remove-Item node_modules, pnpm-lock.yaml -Force -Recurse -ErrorAction Ignore
pnpm install
```

### Issue: TypeScript Errors in Build

```powershell
cd apps/web

# Run typecheck with detailed output
pnpm typecheck 2>&1 | Select-Object -First 50
```

### Issue: WSL Configuration (Terminal Tool)

The terminal tool in the IDE requires WSL. To use the `run_in_terminal` tool:

```powershell
# From Admin PowerShell
wsl.exe --install --no-distribution

# Or install specific distro
wsl.exe --install Ubuntu-22.04
```

For local development, use PowerShell commands directly (see above).

---

## Test Execution Summary Template

When running tests locally, record results:

```
# Test Execution Log - [DATE]

## Compiler A (Vite)
- [ ] TypeScript Typecheck: ✓/✗ [Notes]
- [ ] Vite Build: ✓/✗ [Notes]
- [ ] Build Artifacts: ✓/✗ [Notes]
- [ ] Dev Server: ✓/✗ [Notes]
- [ ] Determinism: ✓/✗ [Notes]

## Compiler B (Single-File)
- [ ] Input Validation: ✓/✗ [Notes]
- [ ] Compilation: ✓/✗ [Notes]
- [ ] Output Validation: ✓/✗ [Notes]
- [ ] Watch Mode: ✓/✗ [Notes]
- [ ] Determinism: ✓/✗ [Notes]

## Acceptance Tests
- [ ] Full Suite: ✓/✗ [Compiler A], ✓/✗ [Compiler B]

## Contracts
- [ ] OpenAPI Generation: ✓/✗ [Notes]
- [ ] TypeScript Codegen: ✓/✗ [Notes]
- [ ] Type Imports: ✓/✗ [Notes]

## Overall
- [ ] All Tests Pass: ✓/✗
- [ ] Ready for Production: ✓/✗
- [ ] Issues Found: [List]
- [ ] Recommendations: [List]
```

---

## Next Steps

1. **Run test plan locally** (Windows PowerShell terminal)
2. **Record results** in execution summary
3. **Fix any failures** with reference to troubleshooting
4. **Verify production readiness** (Test Plan 6)
5. **Proceed to production hardening** (see next section)

---

See also:

- [HTML_TS_COMPILERS.md](./HTML_TS_COMPILERS.md) — Developer guide
- [CONTRACT_INTEGRATION_CHECKLIST.md](./CONTRACT_INTEGRATION_CHECKLIST.md) — Contract setup
- [VSCODE_SETUP.md](./VSCODE_SETUP.md) — Development environment
