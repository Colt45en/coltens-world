# World Engine - Python Windows Service Architecture

## 🎯 Overview

Production-ready Windows service architecture for World Engine with proper separation:

- **Chat Server (3000)**: WebSocket chat with envelope protocol
- **Tool Server (3001)**: HTTP tool execution with policy enforcement
- **Desktop Host (3002)**: User-session desktop automation (PyAutoGUI)

## 📁 Project Structure

```
world-engine/
├── ops/
│   ├── win-service/
│   │   ├── world_engine_core_service.py    # Windows Service
│   │   ├── install_service.ps1             # Install script
│   │   └── remove_service.ps1              # Remove script
│   ├── servers/
│   │   ├── __init__.py
│   │   ├── schemas.py                      # Pydantic models
│   │   ├── policy.py                       # Safety rules
│   │   ├── chat_server.py                 # WS chat (port 3000)
│   │   ├── tool_server.py                 # HTTP tools (port 3001)
│   │   └── desktop_host.py                 # Desktop automation (port 3002)
│   └── tasks/
│       ├── install_desktop_host_task.ps1   # At-logon task
│       └── remove_desktop_host_task.ps1    # Remove task
├── logs/                                   # Service logs
└── requirements.txt                        # Python dependencies
```

## 🚀 Quick Start

### 1. Install Dependencies

```powershell
cd "world-engine"
py -m pip install -r requirements.txt
py -m pywin32_postinstall -install
```

### 2. Test Individual Servers

```powershell
# Chat server (WebSocket)
py -m uvicorn ops.servers.chat_server:app --host 127.0.0.1 --port 3000

# Tool server (HTTP)
py -m uvicorn ops.servers.tool_server:app --host 127.0.0.1 --port 3001

# Desktop host (user session)
py -m uvicorn ops.servers.desktop_host:app --host 127.0.0.1 --port 3002
```

### 3. Install as Windows Service

**Admin PowerShell:**

```powershell
# Install core service (chat + tools)
.\ops\win-service\install_service.ps1

# Install desktop host task (runs at logon)
.\ops\tasks\install_desktop_host_task.ps1
```

### 4. Verify Installation

```powershell
# Check service status
sc query WorldEngineCoreSvc

# Check scheduled task
Get-ScheduledTask -TaskName "WorldEngineDesktopHost"
```

## 🔧 API Endpoints

### Chat Server (Port 3000)
- `GET /health` - Health check
- `WS /ws/chat` - WebSocket chat with envelope protocol

### Tool Server (Port 3001)
- `GET /health` - Health check
- `POST /tool/execute` - Execute tools with policy validation

### Desktop Host (Port 3002)
- `GET /health` - Health check
- `POST /desktop/execute` - Desktop automation actions

## 📋 Current Status

### ✅ Working
- Chat server with WebSocket envelope protocol
- Tool server with policy enforcement
- Windows service infrastructure
- Installation scripts
- Basic schemas and models

### 🔄 In Progress
- Desktop host (needs PyAutoGUI installation)
- Ollama integration for AI chat
- UI screenshot rendering

### 🎯 Next Steps

1. **Complete PyAutoGUI Setup**
   ```powershell
   py -m pip install pyautogui pillow
   ```

2. **Test Desktop Automation**
   ```powershell
   # Test screenshot
   Invoke-WebRequest -Uri http://127.0.0.1:3002/desktop/execute `
     -Method POST `
     -Body '{"action":{"kind":"screenshot"},"trace_id":"test","session_id":"test"}' `
     -ContentType "application/json"
   ```

3. **Add Ollama Integration**
   - Connect chat_server.py to Ollama API
   - Enable tool calling from AI responses

4. **UI Integration**
   - Add screenshot rendering in chat UI
   - Connect tool results to chat context

## 🛡️ Security & Safety

- **Policy Enforcement**: Blocked dangerous key combos and actions
- **Desktop Isolation**: Automation runs in user session only
- **Request Validation**: Strict Pydantic schemas
- **Fail-safe**: PyAutoGUI fail-safe enabled

## 📊 Architecture Benefits

- **Production Ready**: Real Windows service, not background processes
- **User Session Support**: Desktop automation works with GUI apps
- **Policy Controlled**: Safety rules prevent dangerous actions
- **Scalable**: Clean separation between chat, tools, and desktop
- **Maintainable**: Modular design with clear contracts

## 🔧 Troubleshooting

### Service Won't Start
```powershell
# Check logs
Get-Content "logs/chat_3000.err.log"
Get-Content "logs/tools_3001.err.log"

# Check event viewer
eventvwr.msc
```

### Desktop Host Not Working
```powershell
# Must run in user session (not as service)
# Use scheduled task for auto-start at logon
```

### Port Conflicts
```powershell
# Check what's using ports
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :3002
```

---

**Ready for production Windows deployment!** 🎉
