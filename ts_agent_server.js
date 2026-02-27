const express = require("express");

const HOST = process.env.TS_AGENT_HOST || "127.0.0.1";
const PORT = parseInt(process.env.TS_AGENT_PORT || "3002", 10);

const MAX_JSON = process.env.MAX_JSON || "1mb";
const DEBUG = (process.env.DEBUG || "true").toLowerCase() === "true";

function ok(result) {
  return { success: true, result };
}

function fail(error, code) {
  return { success: false, error, code };
}

function normalizeKind(kind) {
  if (typeof kind !== "string") return "";
  if (kind.startsWith("agent_ts.")) return "ts." + kind.slice("agent_ts.".length);
  if (kind.startsWith("agent_py.")) return "py." + kind.slice("agent_py.".length);
  if (kind.startsWith("agent_hub.")) return "hub." + kind.slice("agent_hub.".length);
  return kind;
}

const tools = Object.create(null);

tools["ts.health"] = async (action, ctx) => {
  return ok({ ok: true, service: "ts-agent", lang: "node", now_ms: ctx.now_ms });
};

tools["ts.uppercase"] = async (action) => {
  const text = typeof action.text === "string" ? action.text : "";
  return ok({ text: text.toUpperCase(), len: text.length });
};

tools["ts.reverse"] = async (action) => {
  const text = typeof action.text === "string" ? action.text : "";
  return ok({ text: text.split("").reverse().join(""), len: text.length });
};

tools["ts.sha256"] = async (action) => {
  const crypto = require("node:crypto");
  const text = action.text;
  if (typeof text !== "string") return fail("Missing required string field: text", "BAD_ARGS");
  const hash = crypto.createHash("sha256").update(text, "utf8").digest("hex");
  return ok({ text, sha256: hash });
};

tools["ts.list_tools"] = async () => {
  return ok({ ok: true, tools: Object.keys(tools).sort() });
};

const app = express();

// JSON parse
app.use(express.json({ limit: MAX_JSON }));

// Invalid JSON handler => BAD_JSON
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    res.status(400).json(fail("couldn't parse JSON", "BAD_JSON"));
    return;
  }
  next(err);
});

if (DEBUG) {
  app.use((req, res, next) => {
    console.log(`[ts-agent] ${req.method} ${req.path}`);
    next();
  });
}

app.post("/tool/execute", async (req, res) => {
  try {
    const body = req.body || {};
    const action = body.action || {};
    const trace_id = body.trace_id || "";
    const session_id = body.session_id || "";

    const kind = normalizeKind(action.kind);
    action.kind = kind;

    const ctx = {
      trace_id,
      session_id,
      now_ms: Date.now(),
    };

    const fn = tools[kind];
    if (!fn) {
      res.status(200).json(fail("Tool not registered", "UNKNOWN_TOOL"));
      return;
    }

    const out = await fn(action, ctx);
    res.status(200).json(out);
  } catch (e) {
    res.status(200).json(fail(e && e.message ? e.message : "runtime error", "TS_RUNTIME_ERROR"));
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[ts-agent] listening on http://${HOST}:${PORT}`);
});
