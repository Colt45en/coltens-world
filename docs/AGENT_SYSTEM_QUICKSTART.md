# World Engine - Agent System Quick Start

## 🚀 Installation & Setup

### 1. Install Dependencies

```bash
# From workspace root
cd apps/agent-server
pnpm install
```

### 2. Start All Services

```bash
# From workspace root
.\start-agent-system.ps1
```

This will start:
- **Python Sidecar** (Port 8002) - Audio/Visual processing
- **Brain Service** (Port 8001) - AI cognition
- **Nucleus Hub** (Port 8000) - WebSocket orchestration
- **Agent Server** (Port 8765) - Main agent interface

### 3. Access Agent Chat

Open in browser: **http://localhost:8765/**

Or access via World Engine IDE: **http://localhost:5173/lab/agent-chat**

## 📋 Service URLs

| Service | Port | URL |
|---------|------|-----|
| Agent Chat | 8765 | http://localhost:8765 |
| Brain | 8001 | http://localhost:8001 |
| Sidecar | 8002 | http://localhost:8002 |
| Nucleus | 8000 | http://localhost:8000 |
| IDE Web | 5173 | http://localhost:5173 |

## ✅ Verify Installation

```bash
# Check all services
curl http://localhost:8765/health  # Agent Server
curl http://localhost:8001/health  # Brain
curl http://localhost:8002/health  # Sidecar
curl http://localhost:8000/health  # Nucleus
```

## 🧪 Test Features

1. **Text Chat**
   - Type a message and press Enter
   - Should get AI response from Brain service

2. **Audio Recording**
   - Click 🎤 microphone button
   - Speak for a few seconds
   - Click again to stop
   - Should transcribe and respond

3. **Image Analysis**
   - Click 📷 camera button
   - Select an image
   - Should analyze and describe the image

## 🐛 Troubleshooting

### Agent Server Won't Start
```bash
# Check if port 8765 is in use
Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue

# Kill process if needed
taskkill /F /PID <PID>

# Restart
cd apps/agent-server
npm run dev
```

### No AI Responses
```bash
# Ensure Brain service is running
curl http://localhost:8001/health

# Check logs in Brain service terminal
```

### Audio/Visual Not Working
```bash
# Ensure Python Sidecar is running
curl http://localhost:8002/health

# Check logs in Sidecar terminal
```

## 📝 Next Steps

1. Configure external AI APIs (OpenAI, Anthropic) in Brain service
2. Add Whisper API key for audio transcription
3. Add GPT-4V API key for visual analysis
4. Customize agent capabilities
5. Add authentication/authorization

## 📚 Documentation

- [Agent Server README](apps/agent-server/README.md)
- [Python Sidecar Agent Routes](apps/py-sidecar/routes_agent.py)
- [Brain Service Integration](apps/brain/README.md)

---

**Built with ❤️ for World Engine**
