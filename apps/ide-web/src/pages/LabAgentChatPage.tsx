import React from "react";
import AgentChatPanel from "../components/AgentChatPanel";

/**
 * LabAgentChatPage - Full-screen agent chat interface integrated into World Engine
 *
 * Features:
 * - Multi-modal agent communication (text, audio, visual)
 * - Real-time WebSocket connection to agent server (port 8765)
 * - Audio recording with transcription
 * - Image upload with visual analysis
 * - Connection to Brain service for AI responses
 * - Connection to Python Sidecar for media processing
 */
export function LabAgentChatPage() {
  return (
    <div className="h-full w-full">
      <AgentChatPanel
        serverUrl="ws://localhost:8765/ws/agent"
        embedded={true}
      />
    </div>
  );
}
