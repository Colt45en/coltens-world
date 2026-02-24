// example.connect.ts
import { InMemoryBus } from "./bus";
import { connectSandboxToBus, installToolAllowlistGuard } from "./sandbox.bus.connect";
import { Sandbox, tools } from "./sandbox-tools"; // <-- your sandbox v2 file

const bus = new InMemoryBus();
bus.on((env) => {
  // Here your UI / nucleus / logger consumes deterministic envelopes
  console.log(`[BUS] ${env.severity} ${env.type}`, env.data);
});

const sandbox = Sandbox.bootstrap();
for (const [name, fn] of Object.entries(tools)) sandbox.registerTool(name, fn);

// Bridge sandbox -> bus
connectSandboxToBus({
  sandbox,
  bus,
  source: "worker.sandbox",
  traceId: "trace_12345678",
  parentSpanId: "span_root_12345678",
});

// Install allowlist guard
const allowlist = {
  version: "nucleus.tool_allowlist.v1",
  tools: [
    {
      tool_id: "setVar",
      title: "Set a runtime var",
      description: "Sets a runtime var key/value",
      command: "internal",
      args_template: [],
      allowed_vars: { key: "string", value: "string" },
    },
    {
      tool_id: "addAgent",
      title: "Add agent",
      description: "Adds an agent to orchestration",
      command: "internal",
      args_template: [],
      allowed_vars: { name: "string", role: "string", model: "string" },
    },
  ],
};

installToolAllowlistGuard({
  sandbox,
  bus,
  source: "worker.sandbox",
  traceId: "trace_12345678",
  parentSpanId: "span_root_12345678",
  allowlistJson: allowlist,
});

// ✅ Allowed
sandbox.runTool("addAgent", { name: "A1", role: "worker", model: "x" }, { reason: "demo", by: "me" });

// ❌ Blocked: key not declared in allowed_vars -> emits sandbox.tool.blocked on bus
try {
  sandbox.runTool("addAgent", { name: "A2", role: "worker", model: "x", EXTRA: "nope" }, { reason: "demo", by: "me" });
} catch (e) {
  console.error("Expected:", (e as Error).message);
}
