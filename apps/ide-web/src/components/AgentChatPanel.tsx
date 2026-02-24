import React, { useEffect, useRef, useState } from "react";

interface AgentMessage {
  id: string;
  type: "chat" | "audio" | "visual" | "system";
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: number;
  metadata?: Record<string, any>;
}

interface AgentCapability {
  name: string;
  type: string;
  enabled: boolean;
}

interface AgentChatProps {
  serverUrl?: string;
  embedded?: boolean;
  onMessage?: (message: AgentMessage) => void;
}

export default function AgentChatPanel({
  serverUrl = "ws://localhost:8765/ws/agent",
  embedded = false,
  onMessage
}: AgentChatProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "init",
      type: "system",
      content: "Welcome to World Engine Agent! I can assist you with text, audio, and visual conversations.",
      role: "system",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [capabilities, setCapabilities] = useState<AgentCapability[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const convoIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(serverUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[Agent] Connected");
          setConnectionStatus("connected");
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          handleServerMessage(data);
        };

        ws.onclose = () => {
          console.log("[Agent] Disconnected");
          setConnectionStatus("disconnected");
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (error) => {
          console.error("[Agent] Error:", error);
          setConnectionStatus("disconnected");
        };
      } catch (error) {
        console.error("[Agent] Failed to connect:", error);
        setConnectionStatus("disconnected");
      }
    };

    connectWebSocket();

    return () => {
      wsRef.current?.close();
    };
  }, [serverUrl]);

  const handleServerMessage = (data: any) => {
    switch (data.type) {
      case "connected":
        convoIdRef.current = data.convoId;
        if (data.capabilities) {
          setCapabilities(data.capabilities);
        }
        break;

      case "response": {
        const newMessage: AgentMessage = {
          id: data.data.id || Date.now().toString(),
          type: data.data.type,
          content: data.data.content,
          role: "assistant",
          timestamp: data.data.timestamp,
          metadata: data.data.metadata,
        };
        setMessages((prev) => [...prev, newMessage]);
        setIsTyping(false);
        if (onMessage) onMessage(newMessage);
        break;
      }

      case "error": {
        const errorMessage: AgentMessage = {
          id: Date.now().toString(),
          type: "system",
          content: data.message,
          role: "system",
          timestamp: Date.now(),
          metadata: { error: true },
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsTyping(false);
        break;
      }
    }
  };

  const sendTextMessage = () => {
    const text = inputText.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      type: "chat",
      content: text,
      role: "user",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    wsRef.current.send(JSON.stringify({
      type: "chat",
      content: text,
    }));
  };

  const toggleAudioRecording = async () => {
    if (isRecording) {
      stopAudioRecording();
    } else {
      startAudioRecording();
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudioMessage(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("[Agent] Audio recording error:", error);
      const errorMsg: AgentMessage = {
        id: Date.now().toString(),
        type: "system",
        content: "Microphone access denied or unavailable",
        role: "system",
        timestamp: Date.now(),
        metadata: { error: true },
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioMessage = async (audioBlob: Blob) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Audio = (reader.result as string).split(",")[1];

      const audioMessage: AgentMessage = {
        id: Date.now().toString(),
        type: "audio",
        content: "🎤 Audio message",
        role: "user",
        timestamp: Date.now(),
        metadata: { audio: true },
      };

      setMessages((prev) => [...prev, audioMessage]);
      setIsTyping(true);

      wsRef.current!.send(JSON.stringify({
        type: "audio",
        data: base64Audio,
      }));
    };
    reader.readAsDataURL(audioBlob);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Image = reader.result as string;

      const imageMessage: AgentMessage = {
        id: Date.now().toString(),
        type: "visual",
        content: "📷 Image uploaded",
        role: "user",
        timestamp: Date.now(),
        metadata: { image: base64Image },
      };

      setMessages((prev) => [...prev, imageMessage]);
      setIsTyping(true);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "visual",
          data: base64Image,
          prompt: "What do you see in this image?",
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const StatusIndicator = () => (
    <div className={`flex items-center gap-2 text-sm ${
      connectionStatus === "connected" ? "text-emerald-400" :
      connectionStatus === "connecting" ? "text-yellow-400" :
      "text-red-400"
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        connectionStatus === "connected" ? "bg-emerald-400 animate-pulse" :
        connectionStatus === "connecting" ? "bg-yellow-400" :
        "bg-red-400"
      }`} />
      {connectionStatus === "connected" ? "Connected" :
       connectionStatus === "connecting" ? "Connecting..." :
       "Disconnected"}
    </div>
  );

  return (
    <div className={`flex flex-col ${embedded ? "h-full" : "h-screen"} bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2 text-white font-semibold">
          <span className="text-2xl">🤖</span>
          <span>World Engine Agent</span>
        </div>
        <StatusIndicator />
      </div>

      {/* Capabilities */}
      <div className="flex gap-2 px-4 py-2 bg-black/20 border-b border-white/10 overflow-x-auto">
        {capabilities.map((cap) => (
          <div
            key={cap.name}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              cap.enabled
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-white/5 text-white/40 border border-white/10"
            }`}
          >
            {cap.name}
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === "user"
                ? "bg-gradient-to-br from-purple-500 to-pink-500"
                : msg.role === "assistant"
                ? "bg-gradient-to-br from-blue-500 to-cyan-500"
                : "bg-gradient-to-br from-gray-700 to-gray-600"
            }`}>
              {msg.role === "user" ? "👤" : msg.role === "assistant" ? "🤖" : "⚙️"}
            </div>
            <div className="flex-1 max-w-[80%]">
              <div className={`rounded-2xl px-4 py-2 ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white"
                  : msg.metadata?.error
                  ? "bg-red-500/20 border border-red-500/30 text-red-200"
                  : "bg-white/10 backdrop-blur-sm text-white"
              }`}>
                {msg.content}
                {msg.metadata?.image && (
                  <img
                    src={msg.metadata.image}
                    alt="Uploaded"
                    className="mt-2 rounded-lg max-w-full"
                  />
                )}
              </div>
              <div className="text-xs text-white/50 mt-1 px-2">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500">
              🤖
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
                <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-black/30 backdrop-blur-sm border-t border-white/10">
        <div className="flex items-end gap-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            id="image-upload"
            onChange={handleImageUpload}
          />
          <label
            htmlFor="image-upload"
            className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
          >
            📷
          </label>
          <button
            onClick={toggleAudioRecording}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform ${
              isRecording
                ? "bg-red-500 animate-pulse"
                : "bg-gradient-to-br from-pink-500 to-red-500"
            }`}
          >
            {isRecording ? "⏹️" : "🎤"}
          </button>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendTextMessage();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 bg-white/10 backdrop-blur-sm text-white placeholder-white/50 rounded-2xl px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={1}
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={sendTextMessage}
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            📤
          </button>
        </div>
      </div>
    </div>
  );
}
