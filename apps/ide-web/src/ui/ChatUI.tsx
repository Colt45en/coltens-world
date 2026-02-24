/**
 * Chat Component - React UI for agentic chat
 *
 * Displays:
 * - Chat message history
 * - Input field
 * - Streaming responses
 * - Citations + memory writes
 * - Tool results
 */

import type { ToolCall } from "@world-engine/protocol";
import React, { useEffect, useRef, useState } from "react";
import { displayToolEffect, handleToolCommand, type AnyEnv } from "../tools/toolHandler";
import { ChatClient } from "./ChatClient";
import "./ChatUI.css";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  citations: Array<{ url: string; title: string; snippet: string | undefined }> | undefined;
  toolCalls: ToolCall[] | undefined;
}

export interface ChatUIProps {
  userId: string;
  convoId: string;
  wsUrl?: string;
  onError?: (error: string) => void;
}

function citationKey(prefix: string, cit: { url: string; title: string }): string {
  return `${prefix}-${cit.url}-${cit.title}`;
}

function toolCallKey(prefix: string, tool: ToolCall): string {
  return `${prefix}-${tool.name}-${JSON.stringify(tool.args ?? {})}`;
}

export const ChatUI: React.FC<ChatUIProps> = ({ userId, convoId, wsUrl, onError }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [citations, setCitations] = useState<
    Array<{ url: string; title: string; snippet: string | undefined }>
  >([]);
  const [memory, setMemory] = useState<Record<string, string>>({});

  const clientRef = useRef<ChatClient | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat client
  useEffect(() => {
    const client = new ChatClient({
      userId,
      convoId,
      wsUrl: wsUrl ?? "ws://localhost:3000",
      onMessage: (text) => setCurrentResponse((prev) => prev + text),
      onCitation: (url, title, snippet) => {
        setCitations((prev) => [...prev, { url, title, snippet: snippet ?? undefined }]);
      },
      onMemoryWrite: (key, value) => {
        setMemory((prev) => ({ ...prev, [key]: value }));
      },
      onToolsQueued: (tools) => {
        setCurrentToolCalls(tools);
      },
      onToolCommand: async (env: AnyEnv) => {
        // Handle tool.command.v1 from Nucleus
        console.log("[ChatUI] Received tool.command.v1:", env.payload?.name);
        const send = (effectEnv: AnyEnv) => {
          client.sendToolEffect(
            effectEnv.traceId || env.traceId || "tr-unknown",
            effectEnv.payload?.toolCallId || "tc-unknown",
            effectEnv.payload?.name || "unknown",
            effectEnv.payload?.status || "error",
            effectEnv.payload?.result || effectEnv.payload?.error || {},
          );
        };
        await handleToolCommand(env, send);
      },
      onToolEffect: (env: AnyEnv) => {
        // Display tool.effect.v1 results (e.g., from query_lexicon)
        console.log("[ChatUI] Received tool.effect.v1:", env.payload?.name);
        displayToolEffect(env);
      },
      onToolCall: async (tool) => {
        console.log("Tool call:", tool);
      },
      onError: (err) => {
        console.error("Chat error:", err);
        onError?.(err);
      },
      onStreamStart: () => {
        setIsStreaming(true);
        setCurrentResponse("");
        setCurrentToolCalls([]);
        setCitations([]);
      },
      onStreamEnd: () => {
        setIsStreaming(false);
        // Add assistant message to history
        if (currentResponse) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: "assistant",
              text: currentResponse,
              timestamp: Date.now(),
              citations: citations.length > 0 ? citations : undefined,
              toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
            },
          ]);
        }
      },
    });

    clientRef.current = client;

    // Connect on mount
    client.connect().catch((err) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[ChatUI] Failed to connect to chat:", errorMsg);
      onError?.(`Connection failed: ${errorMsg}`);
    });

    return () => {
      client.close();
    };
  }, [userId, convoId, wsUrl, onError]);

  // Auto-scroll to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentResponse]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !clientRef.current) return;

    // Add user message to history
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      text: inputText,
      timestamp: Date.now(),
      citations: undefined,
      toolCalls: undefined
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");

    try {
      await clientRef.current.sendMessage(inputText, {
        mapId: "default",
        playerPos: [0, 0, 0],
        visibleEntities: [],
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      onError?.(`Failed to send message: ${errorMsg}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const statusLabel = isStreaming ? "Streaming" : "Ready";

  return (
    <div className="chat-ui">
      <div className="chat-header">
        <h2>Fusion Chat Core</h2>
        <p className="chat-info">
          User: {userId} | Session: {convoId} | Status: {statusLabel}
        </p>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            <div className="message-text">{msg.text}</div>
            {msg.citations && msg.citations.length > 0 && (
              <div className="citations">
                {msg.citations.map((cit) => (
                  <a
                    key={citationKey(msg.id, cit)}
                    href={cit.url}
                    className="citation-chip"
                    title={cit.snippet}
                  >
                    {cit.title}
                  </a>
                ))}
              </div>
            )}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="tool-calls">
                <div className="tool-calls-header">Tools:</div>
                {msg.toolCalls.map((tool) => (
                  <div key={toolCallKey(msg.id, tool)} className="tool-call">
                    <span className="tool-name">{tool.name}</span>
                    {Object.keys(tool.args || {}).length > 0 && (
                      <span className="tool-args">{JSON.stringify(tool.args)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
          </div>
        ))}

        {isStreaming && (
          <div className="message message-assistant streaming">
            <div className="message-text">{currentResponse}</div>
            {citations.length > 0 && (
              <div className="citations">
                {citations.map((cit) => (
                  <a
                    key={citationKey("streaming", cit)}
                    href={cit.url}
                    className="citation-chip"
                    title={cit.snippet}
                  >
                    {cit.title}
                  </a>
                ))}
              </div>
            )}
            {currentToolCalls.length > 0 && (
              <div className="tool-calls">
                <div className="tool-calls-header">Tools queued:</div>
                {currentToolCalls.map((tool) => (
                  <div key={toolCallKey("streaming", tool)} className="tool-call">
                    <span className="tool-name">{tool.name}</span>
                    {Object.keys(tool.args || {}).length > 0 && (
                      <span className="tool-args">{JSON.stringify(tool.args)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          aria-label="Chat input - Enter engine command"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter engine command..."
          disabled={isStreaming}
          className="chat-input"
        />
        <button
          onClick={handleSendMessage}
          disabled={isStreaming || !inputText.trim()}
          className="chat-send-btn"
        >
          {isStreaming ? "Waiting..." : "Send"}
        </button>
      </div>

      {Object.keys(memory).length > 0 && (
        <div className="chat-memory">
          <details>
            <summary>Memory ({Object.keys(memory).length} items)</summary>
            <ul>
              {Object.entries(memory).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {value}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
};
