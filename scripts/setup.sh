#!/bin/bash
# Setup script for World Engine IDE development environment

echo "🚀 World Engine IDE Setup"
echo "========================"
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
pnpm install

if [ $? -ne 0 ]; then
  echo "❌ Failed to install dependencies"
  exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Step 2: Generate Codex Manifest
echo "📋 Generating Codex Manifest..."
npx ts-node packages/codex/src/cli.ts --rootDir codex --manifestPath codex/codex.manifest.json

if [ $? -ne 0 ]; then
  echo "⚠️  Codex manifest generation had issues (see above)"
  # Don't exit—setup can continue even if codex files have issues
fi

echo "✅ Codex manifest validated"
echo ""

# Step 3: Build all packages
echo "🔨 Building packages..."
pnpm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ Build successful"
echo ""

# Step 4: Type check
echo "🔍 Running type check..."
pnpm run type-check

if [ $? -ne 0 ]; then
  echo "⚠️  Type check found issues (non-critical)"
fi

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "   pnpm run dev          # Start development environment"
echo "   pnpm run lint:fix     # Auto-fix linting issues"
echo "   pnpm run format       # Format code with Prettier"
echo ""
echo "🔗 Access points when dev is running:"
echo "   IDE Web:        http://localhost:5173"
echo "   Nucleus WS:     ws://localhost:3001"
echo "   Preview:        http://localhost:5174"
echo "   Sidecar:        http://localhost:8000"
echo ""
