# World Engine - Agent Server

**Multi-modal AI Agent System for World Engine**

The Agent Server is a Node.js/TypeScript service that orchestrates multi-modal AI conversations, integrating text, audio, and visual inputs through WebSocket and HTTP APIs.

## 🏗️ Architecture

```
┌─────────────────┐         ┌─────────────────┐
│  HTML Interface │◄────────►│  Agent Server   │
│  (Port 8765)    │ WebSocket│  (Node.js)      │
└─────────────────┘         └────────┬────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
              │   Brain   │   │  Sidecar  │   │  Nucleus  │
              │ (Port     │   │ (Python)  │   │  (WebSocket│
              │  8001)    │   │ Port 8002 │   │  Hub)     │
              └───────────┘   └───────────┘   └───────────┘
                    │               │
                    │               ├─► Audio Processing
                    │               │   (Whisper, TTS)
                    │               │
                    │               └─► Visual Analysis
                    │                   (GPT-4V, YOLO)
                    │
                    └─► Text Chat (AI Responses)
```

## ⚡ Features

- **Multi-Modal Capabilities**
  - 💬 Text chat with AI
  - 🎤 Audio input (recording + transcription)
  - 🔊 Audio output (text-to-speech)
  - 👁️ Visual analysis (image understanding)
  - 🛠️ Code execution (sandboxed)

- **Real-Time Communication**
  - WebSocket API for instant bidirectional messaging
  - HTTP REST API for programmatic access
  - Connection status monitoring
  - Auto-reconnect on disconnect

- **Conversation Management**
  - Persistent conversation contexts
  - Message history (last 50 messages)
  - Active tool tracking
  - User preferences storage

- **Service Integration**
  - Brain service for AI cognition
  - Python Sidecar for media processing
  - Nucleus for orchestration
  - Extensible capability system

## 🚀 Quick Start

### Installation

```bash
cd apps/agent-server
pnpm install
```

### Development

```bash
npm run dev
```

Server starts on **port 8765**.

### Production

```bash
npm run build
npm start
```

## 📡 API Reference

### WebSocket API

**Endpoint:** `ws://localhost:8765/ws/agent`

#### Client → Server Messages

```typescript
// Text message
{
  type: "chat",
  content: "Hello, agent!"
}

// Audio message (base64 encoded)
{
  type: "audio",
  data: "data:audio/webm;base64,..."
}

// Visual message (base64 encoded image)
{
  type: "visual",
  data: "data:image/png;base64,...",
  prompt: "What do you see in this image?"
}

// Keep-alive ping
{
  type: "ping"
}
```

#### Server → Client Messages

```typescript
// Connection established
{
  type: "connected",
  convoId: "uuid",
  capabilities: [
    { name: "Text Chat", type: "text-chat", enabled: true },
    { name: "Audio Input", type: "audio-input", enabled: true },
    // ...
  ]
}

// Agent response
{
  type: "response",
  data: {
    id: "msg-uuid",
    type: "chat",
    content: "Hello! How can I help you?",
    role: "assistant",
    timestamp: 1234567890,
    metadata: {}
  }
}

// Pong (keep-alive response)
{
  type: "pong"
}

// Error
{
  type: "error",
  message: "Error description"
}
```

### HTTP API

#### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "agent-server",
  "version": "1.0.0"
}
```

#### `GET /agent/capabilities`

Get available agent capabilities.

**Response:**
```json
{
  "capabilities": [
    {
      "name": "Text Chat",
      "type": "text-chat",
      "enabled": true,
      "config": {}
    }
    // ...
  ]
}
```

#### `POST /agent/chat`

Send a text message to the agent.

**Request:**
```json
{
  "message": "Hello, agent!",
  "conversationId": "optional-convo-id"
}
```

**Response:**
```json
{
  "id": "msg-uuid",
  "type": "chat",
  "content": "Hello! How can I help you?",
  "role": "assistant",
  "timestamp": 1234567890,
  "metadata": {}
}
```

#### `POST /agent/audio`

Process audio input.

**Request:**
```json
{
  "audio": "base64-encoded-audio",
  "conversationId": "optional-convo-id"
}
```

**Response:**
```json
{
  "transcription": "User said something",
  "response": {
    "id": "msg-uuid",
    "content": "Agent response",
    // ...
  }
}
```

#### `POST /agent/visual`

Analyze visual input.

**Request:**
```json
{
  "image": "base64-encoded-image",
  "prompt": "What do you see?",
  "conversationId": "optional-convo-id"
}
```

**Response:**
```json
{
  "analysis": "I see a landscape with mountains...",
  "response": {
    "id": "msg-uuid",
    "content": "Agent response",
    // ...
  }
}
```

#### `GET /agent/conversation/:id`

Get conversation history.

**Response:**
```json
{
  "id": "convo-uuid",
  "messages": [
    {
      "id": "msg-uuid",
      "type": "chat",
      "content": "Hello",
      "role": "user",
      "timestamp": 1234567890
    }
    // ...
  ],
  "activeTools": [],
  "preferences": {}
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Server
PORT=8765
HOST=0.0.0.0

# Service URLs
BRAIN_URL=http://127.0.0.1:8001
SIDECAR_URL=http://127.0.0.1:8002
NUCLEUS_URL=http://127.0.0.1:8000

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Service Integration

The agent server integrates with:

1. **Brain Service** (Port 8001)
   - Text chat processing
   - AI cognition and reasoning
   - Endpoint: `POST /brain/chat`

2. **Python Sidecar** (Port 8002)
   - Audio transcription: `POST /agent/audio/transcribe`
   - Audio synthesis: `POST /agent/audio/synthesize`
   - Visual analysis: `POST /agent/visual/analyze`
   - Object detection: `POST /agent/visual/objects`

3. **Nucleus** (Port 8000)
   - WebSocket orchestration
   - Event broadcasting
   - Service coordination

## 🧩 Project Structure

```
apps/agent-server/
├── src/
│   └── index.ts          # Main server + AgentOrchestrator
├── public/
│   └── index.html        # HTML chat interface
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 Usage Examples

### Standalone HTML Interface

Open in browser: `http://localhost:8765/`

The standalone interface includes:
- Text chat input
- Audio recording button
- Image upload button
- Real-time status indicator
- Capability badges
- Message history

### Embedded in React

```tsx
import AgentChatPanel from "@/components/AgentChatPanel";

function MyApp() {
  return (
    <AgentChatPanel 
      serverUrl="ws://localhost:8765/ws/agent"
      embedded={true}
      onMessage={(msg) => console.log("Received:", msg)}
    />
  );
}
```

### Programmatic Access (JavaScript)

```javascript
// Connect via WebSocket
const ws = new WebSocket("ws://localhost:8765/ws/agent");

ws.onopen = () => {
  // Send text message
  ws.send(JSON.stringify({
    type: "chat",
    content: "Hello, agent!"
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};

// Or use HTTP API
fetch("http://localhost:8765/agent/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "Hello, agent!"
  })
})
.then(res => res.json())
.then(data => console.log("Response:", data));
```

### Audio Recording

```javascript
// Start recording
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mediaRecorder = new MediaRecorder(stream);
const audioChunks = [];

mediaRecorder.ondataavailable = (event) => {
  audioChunks.push(event.data);
};

mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
  const reader = new FileReader();
  
  reader.onload = () => {
    const base64Audio = reader.result.split(",")[1];
    ws.send(JSON.stringify({
      type: "audio",
      data: base64Audio
    }));
  };
  
  reader.readAsDataURL(audioBlob);
};

mediaRecorder.start();

// Stop after 5 seconds
setTimeout(() => mediaRecorder.stop(), 5000);
```

### Image Upload

```javascript
const fileInput = document.querySelector('input[type="file"]');

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  const reader = new FileReader();
  
  reader.onload = () => {
    const base64Image = reader.result;
    ws.send(JSON.stringify({
      type: "visual",
      data: base64Image,
      prompt: "What do you see in this image?"
    }));
  };
  
  reader.readAsDataURL(file);
});
```

## 🐛 Debugging

### Check Service Health

```bash
# Agent Server
curl http://localhost:8765/health

# Brain Service
curl http://localhost:8001/health

# Python Sidecar
curl http://localhost:8002/health
```

### View Logs

The server logs all major events:
- WebSocket connections/disconnections
- Message processing
- Service requests
- Errors

Example log output:
```
[Agent] WebSocket client connected
[Agent] Processing chat message: "Hello!"
[Agent] Forwarding to Brain: http://127.0.0.1:8001/brain/chat
[Agent] Brain response received
[Agent] WebSocket client disconnected
```

### Common Issues

**Issue:** Cannot connect to agent server
- **Solution:** Ensure server is running (`npm run dev`)
- Check port 8765 is not in use

**Issue:** No response from Brain service
- **Solution:** Start Brain service on port 8001
- Verify BRAIN_URL environment variable

**Issue:** Audio recording not working
- **Solution:** Grant microphone permissions in browser
- Check HTTPS requirement (localhost exception exists)

**Issue:** Image upload fails
- **Solution:** Verify image size < 10MB
- Check Sidecar service is running

## 🚦 Testing

### Manual Testing

1. Start all services:
   ```bash
   ./start-agent-system.ps1
   ```

2. Open http://localhost:8765/

3. Test each capability:
   - Type "Hello" and send
   - Click 🎤 to record audio
   - Click 📷 to upload image

### Integration Testing

```typescript
// Test WebSocket connection
const ws = new WebSocket("ws://localhost:8765/ws/agent");
ws.onopen = () => console.log("✓ Connection successful");

// Test text chat
const response = await fetch("http://localhost:8765/agent/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "test" })
});
console.log("✓ Chat API:", await response.json());
```

## 📚 Related Documentation

- [Python Sidecar Agent Routes](../py-sidecar/routes_agent.py)
- [Brain Service Integration](../brain/README.md)
- [Nucleus WebSocket Hub](../nucleus/README.md)
- [World Engine Documentation](../../README.md)

## 🔮 Future Enhancements

- [ ] Video analysis support
- [ ] Screen sharing and co-browsing
- [ ] Multi-agent conversations
- [ ] Tool execution sandboxing
- [ ] Persistent conversation storage (PostgreSQL)
- [ ] Authentication and authorization
- [ ] Rate limiting
- [ ] Conversation branching
- [ ] Export conversation history
- [ ] Voice cloning for TTS
- [ ] Real-time translation
- [ ] Sentiment analysis
- [ ] Summarization of long conversations

## 📄 License

Part of World Engine

---

**Agent Server v1.0.0** | Built with ❤️ for World Engine
