import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:3000/ws/bus");

ws.on("open", () => {
  console.log("✅ WS connected to /ws/bus");
  ws.send(
    JSON.stringify({
      v: 1,
      id: "test-123",
      ts: new Date().toISOString(),
      type: "pipeline.stage.started",
      source: "test",
      traceId: "trace-abc",
      spanId: "span-123",
      severity: "info",
      data: { stage: "prose.decompose", ms: 100 },
    }),
  );
  console.log("📤 Sent test envelope");
});

ws.on("message", (data) => {
  console.log("📥 Received:", JSON.parse(data.toString()).type);
});

ws.on("error", (err) => {
  console.error("❌ WS error:", err.message);
  process.exit(1);
});

ws.on("close", () => {
  console.log("✅ WS closed");
  process.exit(0);
});

setTimeout(() => {
  ws.close();
}, 2000);
