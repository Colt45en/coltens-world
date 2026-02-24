/**
 * TypeScript Agent Server (CommonJS for universal compat)
 *
 * Run:
 *   npm i express
 *   node ts_agent_server.js
 *
 * Port: 3002
 * Endpoint: POST /tool/execute
 */

const express = require("express");

const app = express();
app.use(express.json({ limit: "5mb" }));

// ========== Response Helpers ==========

function ok(result) {
  return { success: true, result };
}

function fail(error, code = "ERROR") {
  return { success: false, error, code };
}

// ========== Tools ==========

const tools = {
  "ts.health": async () =>
    ok({ ok: true, agent: "ts", now_ms: Date.now() }),

  "ts.uppercase": async (action) => {
    const text = typeof action.text === "string" ? action.text : "";
    return ok({ text: text.toUpperCase(), len: text.length });
  },

  "ts.concat": async (action) => {
    const a = typeof action.a === "string" ? action.a : "";
    const b = typeof action.b === "string" ? action.b : "";
    return ok({ text: a + b });
  },

  "ts.json_parse": async (action) => {
    const text = typeof action.text === "string" ? action.text : "";
    try {
      const obj = JSON.parse(text);
      return ok({ parsed: obj });
    } catch (e) {
      return fail(`JSON parse error: ${e.message}`, "BAD_JSON");
    }
  },

  "ts.words": async (action) => {
    const text = typeof action.text === "string" ? action.text : "";
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    return ok({ words, count: words.length });
  },
};

// ========== Routes ==========

app.get("/health", async (_req, res) => {
  res.json({ ok: true, agent: "ts", now_ms: Date.now(), tools: Object.keys(tools) });
});

app.post("/tool/execute", async (req, res) => {
  try {
    const { action, trace_id, session_id } = req.body || {};
    const kind = action?.kind;

    if (typeof kind !== "string" || !kind) {
      res.status(400).json(fail("Missing action.kind", "BAD_ARGS"));
      return;
    }

    const fn = tools[kind];
    if (!fn) {
      res.status(404).json(fail(`Unknown TS tool: ${kind}`, "UNKNOWN_TOOL"));
      return;
    }

    const out = await fn(action, { trace_id, session_id });
    res.json(out);
  } catch (e) {
    res.status(500).json(fail(`${e.name || "Error"}: ${e.message || String(e)}`, "TS_RUNTIME_ERROR"));
  }
});

// ========== Start ==========

app.listen(3002, () => {
  console.log("🚀 TS Agent listening on http://127.0.0.1:3002");
  console.log(`   Tools: ${Object.keys(tools).join(", ")}`);
});
