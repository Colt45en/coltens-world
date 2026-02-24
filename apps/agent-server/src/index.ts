/**
 * Personal Agent Server - World Engine
 *
 * Orchestrates AI agents with multi-modal capabilities:
 * - Text chat with streaming responses
 * - Audio input/output processing
 * - Visual processing (image/video analysis)
 * - Service integration (Nucleus, Brain, Python Sidecar)
 * - WebSocket real-time communication
 * - iframe embedding support
 */

import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import axios from "axios";
import Fastify from "fastify";
import { nanoid } from "nanoid";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeLedgerClient, shutdownLedgerClient } from "./ledger-integration";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.AGENT_PORT ? parseInt(process.env.AGENT_PORT) : 8765;
const NUCLEUS_URL = process.env.NUCLEUS_URL || "http://127.0.0.1:8000";
const BRAIN_URL = process.env.BRAIN_URL || "http://127.0.0.1:8001";
const SIDECAR_URL = process.env.SIDECAR_URL || "http://127.0.0.1:8002";

// ============================================================================
// Types
// ============================================================================

interface AgentMessage {
  id: string;
  type: "chat" | "audio" | "visual" | "system" | "tool";
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

interface ConversationContext {
  id: string;
  history: AgentMessage[];
  activeTools: string[];
  preferences: Record<string, any>;
}

interface AgentCapability {
  name: string;
  type: "text" | "audio" | "visual" | "multimodal";
  enabled: boolean;
  config: Record<string, any>;
}

// ============================================================================
// Agent State Management
// ============================================================================

class AgentOrchestrator {
  private conversations = new Map<string, ConversationContext>();
  private capabilities: AgentCapability[] = [
    { name: "text-chat", type: "text", enabled: true, config: {} },
    { name: "audio-input", type: "audio", enabled: true, config: { format: "webm" } },
    { name: "audio-output", type: "audio", enabled: true, config: { voice: "alloy" } },
    { name: "visual-analysis", type: "visual", enabled: true, config: {} },
    { name: "code-execution", type: "text", enabled: true, config: {} },
  ];

  getOrCreateConversation(id: string): ConversationContext {
    if (!this.conversations.has(id)) {
      this.conversations.set(id, {
        id,
        history: [],
        activeTools: [],
        preferences: {},
      });
    }
    return this.conversations.get(id)!;
  }

  addMessage(convoId: string, message: AgentMessage): void {
    const convo = this.getOrCreateConversation(convoId);
    convo.history.push(message);

    // Keep only last 50 messages
    if (convo.history.length > 50) {
      convo.history = convo.history.slice(-50);
    }
  }

  getCapabilities(): AgentCapability[] {
    return this.capabilities.filter(c => c.enabled);
  }

  async processTextMessage(convoId: string, text: string): Promise<AgentMessage> {
    const convo = this.getOrCreateConversation(convoId);

    // Add user message to history
    const userMsg: AgentMessage = {
      id: nanoid(),
      type: "chat",
      content: text,
      metadata: { role: "user" },
      timestamp: Date.now(),
    };
    this.addMessage(convoId, userMsg);

    // Forward to Brain service
    try {
      const response = await axios.post(`${BRAIN_URL}/brain/chat`, {
        convoId,
        message: text,
        history: convo.history.slice(-10), // Send last 10 messages for context
      });

      const assistantMsg: AgentMessage = {
        id: nanoid(),
        type: "chat",
        content: response.data.text || response.data.content || "No response",
        metadata: { role: "assistant", model: response.data.model },
        timestamp: Date.now(),
      };
      this.addMessage(convoId, assistantMsg);

      return assistantMsg;
    } catch (error: any) {
      console.error("Brain service error:", error.message);

      // Fallback response
      const fallbackMsg: AgentMessage = {
        id: nanoid(),
        type: "system",
        content: "I'm having trouble connecting to my cognitive services. Please try again.",
        metadata: { error: true },
        timestamp: Date.now(),
      };
      this.addMessage(convoId, fallbackMsg);

      return fallbackMsg;
    }
  }

  async processAudioInput(convoId: string, audioData: Buffer): Promise<AgentMessage> {
    // Forward to Python Sidecar for audio processing
    try {
      const response = await axios.post(
        `${SIDECAR_URL}/agent/audio/transcribe`,
        { audio: audioData.toString("base64") },
        { headers: { "Content-Type": "application/json" } }
      );

      const transcription = response.data.text;

      // Process the transcribed text as a normal chat message
      return this.processTextMessage(convoId, transcription);
    } catch (error: any) {
      console.error("Audio processing error:", error.message);
      return {
        id: nanoid(),
        type: "system",
        content: "Audio processing unavailable",
        metadata: { error: true },
        timestamp: Date.now(),
      };
    }
  }

  async processVisualInput(convoId: string, imageData: string, prompt?: string): Promise<AgentMessage> {
    // Forward to Python Sidecar for visual analysis
    try {
      const response = await axios.post(
        `${SIDECAR_URL}/agent/visual/analyze`,
        { image: imageData, prompt: prompt || "Describe this image" },
        { headers: { "Content-Type": "application/json" } }
      );

      const analysis = response.data.description;

      const visualMsg: AgentMessage = {
        id: nanoid(),
        type: "visual",
        content: analysis,
        metadata: { role: "assistant", modality: "vision" },
        timestamp: Date.now(),
      };
      this.addMessage(convoId, visualMsg);

      return visualMsg;
    } catch (error: any) {
      console.error("Visual processing error:", error.message);
      return {
        id: nanoid(),
        type: "system",
        content: "Visual processing unavailable",
        metadata: { error: true },
        timestamp: Date.now(),
      };
    }
  }
}

// ============================================================================
// Server Setup
// ============================================================================

const app = Fastify({ logger: true });
const orchestrator = new AgentOrchestrator();

await app.register(cors, { origin: true });
await app.register(websocket);

// Serve static files (for iframe embedding)
await app.register(fastifyStatic, {
  root: join(__dirname, "../public"),
  prefix: "/",
});

// ============================================================================
// HTTP Routes
// ============================================================================

// Health check
app.get("/health", async () => {
  return {
    status: "healthy",
    service: "agent-server",
    port: PORT,
    timestamp: Date.now(),
    capabilities: orchestrator.getCapabilities(),
  };
});

// Get agent capabilities
app.get("/agent/capabilities", async () => {
  return {
    capabilities: orchestrator.getCapabilities(),
  };
});

// Send text message
app.post<{ Body: { convoId: string; text: string } }>("/agent/chat", async (request, reply) => {
  const { convoId, text } = request.body;

  if (!convoId || !text) {
    reply.code(400);
    return { error: "Missing convoId or text" };
  }

  const response = await orchestrator.processTextMessage(convoId, text);
  return response;
});

// Process audio input
app.post<{ Body: { convoId: string; audio: string } }>("/agent/audio", async (request, reply) => {
  const { convoId, audio } = request.body;

  if (!convoId || !audio) {
    reply.code(400);
    return { error: "Missing convoId or audio data" };
  }

  const audioBuffer = Buffer.from(audio, "base64");
  const response = await orchestrator.processAudioInput(convoId, audioBuffer);
  return response;
});

// Process visual input
app.post<{ Body: { convoId: string; image: string; prompt?: string } }>("/agent/visual", async (request, reply) => {
  const { convoId, image, prompt } = request.body;

  if (!convoId || !image) {
    reply.code(400);
    return { error: "Missing convoId or image data" };
  }

  const response = await orchestrator.processVisualInput(convoId, image, prompt);
  return response;
});

// Get conversation history
app.get<{ Params: { convoId: string } }>("/agent/conversation/:convoId", async (request) => {
  const { convoId } = request.params;
  const convo = orchestrator.getOrCreateConversation(convoId);
  return {
    id: convo.id,
    messageCount: convo.history.length,
    history: convo.history,
  };
});

// ============================================================================
// WebSocket Route (Real-time Agent Communication)
// ============================================================================

app.get("/ws/agent", { websocket: true }, (ws, request) => {
  const convoId = nanoid();

  console.log(`[Agent WS] New connection: ${convoId}`);

  ws.send(JSON.stringify({
    type: "connected",
    convoId,
    capabilities: orchestrator.getCapabilities(),
    timestamp: Date.now(),
  }));

  ws.on("message", async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "chat": {
          const response = await orchestrator.processTextMessage(convoId, message.content);
          ws.send(JSON.stringify({
            type: "response",
            data: response,
          }));
          break;
        }

        case "audio": {
          const audioBuffer = Buffer.from(message.data, "base64");
          const response = await orchestrator.processAudioInput(convoId, audioBuffer);
          ws.send(JSON.stringify({
            type: "response",
            data: response,
          }));
          break;
        }

        case "visual": {
          const response = await orchestrator.processVisualInput(
            convoId,
            message.data,
            message.prompt
          );
          ws.send(JSON.stringify({
            type: "response",
            data: response,
          }));
          break;
        }

        case "ping":
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          break;

        default:
          ws.send(JSON.stringify({
            type: "error",
            message: `Unknown message type: ${message.type}`,
          }));
      }
    } catch (error: any) {
      console.error("[Agent WS] Error:", error.message);
      ws.send(JSON.stringify({
        type: "error",
        message: error.message,
      }));
    }
  });

  ws.on("close", () => {
    console.log(`[Agent WS] Disconnected: ${convoId}`);
  });

  ws.on("error", (error: Error) => {
    console.error(`[Agent WS] Error on ${convoId}:`, error);
  });
});

// ============================================================================
// Start Server
// ============================================================================

let ledgerClient: any;

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });

  // Initialize Ledger Client for deterministic event sourcing
  try {
    const nucleusLedgerUrl = process.env.LEDGER_URL || "http://127.0.0.1:3000";
    ledgerClient = await initializeLedgerClient({
      ledger_url: nucleusLedgerUrl,
      agent_id: process.env.AGENT_ID || "agent-server-1",
      tool_executor: async (toolName: string, input: any) => {
        // Use the orchestrator's tool execution logic
        // For now, echo the input (you can extend this to call actual tools)
        console.log(`[Agent] Executing tool: ${toolName}`, input);

        // Simple echo/fallback for testing
        switch (toolName) {
          case "math.add":
            return { result: input.a + input.b };
          case "math.multiply":
            return { result: input.a * input.b };
          case "echo":
            return input;
          default:
            // In production, dispatch to actual tool implementations
            throw new Error(`Unknown tool: ${toolName}`);
        }
      },
    });
  } catch (ledgerError) {
    console.warn("[Agent] Ledger initialization failed, continuing without ledger:", ledgerError);
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           🤖 World Engine Agent Server                     ║
║                                                            ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  HTTP:      http://localhost:${PORT}                          ║
║  WebSocket: ws://localhost:${PORT}/ws/agent                  ║
║  Static:    http://localhost:${PORT}/                        ║
║                                                            ║
║  Capabilities:                                             ║
║    ✓ Text Chat (with Brain integration)                   ║
║    ✓ Audio Input/Output (via Python Sidecar)              ║
║    ✓ Visual Analysis (image/video processing)             ║
║    ✓ Multi-modal Conversations                            ║
║    ✓ iframe Embeddable                                     ║
║    ✓ Deterministic Ledger (event sourcing)                ║
║                                                            ║
║  Service Connections:                                      ║
║    • Nucleus:  ${NUCLEUS_URL.padEnd(39)}║
║    • Brain:    ${BRAIN_URL.padEnd(39)}║
║    • Sidecar:  ${SIDECAR_URL.padEnd(39)}║
║    • Ledger:   ${(process.env.LEDGER_URL || "http://127.0.0.1:3000").padEnd(39)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
} catch (err) {
  console.error("Failed to start agent server:", err);
  process.exit(1);
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Agent] Shutting down...");
  if (ledgerClient) {
    shutdownLedgerClient(ledgerClient);
  }
  process.exit(0);
});
