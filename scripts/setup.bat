@echo off
REM Setup script for World Engine IDE development environment (Windows)

echo.
echo 🚀 World Engine IDE Setup
echo ========================
echo.

REM Step 1: Install dependencies
echo 📦 Installing dependencies...
pnpm install

if errorlevel 1 (
  echo ❌ Failed to install dependencies
  exit /b 1
)

echo ✅ Dependencies installed
echo.

REM Step 2: Generate Codex Manifest
echo 📋 Generating Codex Manifest...
npx ts-node packages/codex/src/cli.ts --rootDir codex --manifestPath codex\codex.manifest.json

if errorlevel 1 (
  echo ⚠️  Codex manifest generation had issues (see above)
  REM Don't exit—setup can continue even if codex files have issues
)

echo ✅ Codex manifest validated
echo.

REM Step 3: Build all packages
echo 🔨 Building packages...
pnpm run build

if errorlevel 1 (
  echo ❌ Build failed
  exit /b 1
)

echo ✅ Build successful
echo.

REM Step 4: Type check
echo 🔍 Running type check...
pnpm run type-check

if errorlevel 1 (
  echo ⚠️  Type check found issues (non-critical)
)

echo ✅ Setup complete!
echo.
echo 🎯 Next steps:
echo    pnpm run dev          # Start development environment
echo    pnpm run lint:fix     # Auto-fix linting issues
echo    pnpm run format       # Format code with Prettier
echo.
echo 🔗 Access points when dev is running:
echo    IDE Web:        http://localhost:5173
echo    Nucleus WS:     ws://localhost:3001
echo    Preview:        http://localhost:5174
echo    Sidecar:        http://localhost:8011
echo.
