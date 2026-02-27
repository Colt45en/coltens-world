#!/usr/bin/env bash

# AgentHub startup script for Linux/macOS
# Starts both Python hub (3001) and TS agent (3002)

set -e

echo "================================"
echo "🚀 AgentHub Startup"
echo "================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ python3 not found. Please install Python 3.10+"
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ node not found. Please install Node.js 18+"
    exit 1
fi

# Ensure dependencies
echo "📦 Installing Python dependencies..."
pip install -q fastapi uvicorn httpx pydantic

echo "📦 Installing Node dependencies..."
npm install express &>/dev/null || true

# Kill any existing processes on ports 3001/3002
echo "🧹 Cleaning up old processes..."
lsof -ti:3001,3002 | xargs kill -9 &>/dev/null || true

# Start TS agent in background
echo "🟦 Starting TS Agent on :3002..."
node ts_agent_server.js &
TS_PID=$!

# Start Python hub
echo "🐍 Starting Python Hub on :3001..."
python3 agent_hub_server.py &
PY_PID=$!

# Wait a bit for startup
sleep 2

# Test connectivity
echo "🧪 Running smoke test..."
python3 test_agent_hub.py

echo ""
echo "================================"
echo "✅ AgentHub is ready!"
echo "================================"
echo "🐍 Python Hub:    http://127.0.0.1:3001"
echo "🟦 TS Agent:      http://127.0.0.1:3002"
echo ""
echo "Press Ctrl+C to stop..."
echo ""

# Keep processes running
wait
