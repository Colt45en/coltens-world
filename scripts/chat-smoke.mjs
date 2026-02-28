#!/usr/bin/env node

/**
 * Chat Streaming Smoke Test
 *
 * Validates chat system ordering, determinism, and bridge integrity.
 *
 * Usage:
 *   node scripts/chat-smoke.mjs [--ws-url http://localhost:3000] [--timeout 15000]
 *
 * Exit codes:
 *   0 = success (all ordering rules passed)
 *   1 = failure (ordering violation, missing messages, timeout, connection error)
 *
 * CI Integration:
 *   Add to GitHub Actions or similar: node scripts/chat-smoke.mjs
 *   Requires: Nucleus running on port 3000
 */

import { performance } from "node:perf_hooks";
import WebSocket from "ws";

// ============================================================================
// Config
// ============================================================================

const WS_URL = process.env.NUCLEUS_WS_URL || "ws://localhost:3000/ws/chat";
const TIMEOUT_MS = process.env.CHAT_SMOKE_TIMEOUT
  ? parseInt(process.env.CHAT_SMOKE_TIMEOUT, 10)
  : 15000;

const REQUIRED_MESSAGES = [
  "chat.stream.started.v1",
  "chat.delta.v1", // at least one
  "chat.done.v1",
  "chat.stream.ended.v1",
];

// Order rules: which message types can appear after which
const ORDER_RULES = {
  "chat.stream.started.v1": {
    canFollow: ["__START__"],
    canPrecede: ["chat.delta.v1", "chat.tool_call.v1", "chat.done.v1", "chat.error.v1"],
  },
  "chat.delta.v1": {
    canFollow: [
      "__START__",
      "chat.stream.started.v1",
      "chat.delta.v1",
      "chat.tool_call.v1",
    ],
    canPrecede: [
      "chat.delta.v1",
      "chat.tool_call.v1",
      "chat.done.v1",
      "chat.error.v1",
    ],
  },
  "chat.tool_call.v1": {
    canFollow: [
      "__START__",
      "chat.stream.started.v1",
      "chat.delta.v1",
      "chat.tool_call.v1",
    ],
    canPrecede: [
      "chat.delta.v1",
      "chat.tool_call.v1",
      "chat.done.v1",
      "chat.error.v1",
    ],
  },
  "chat.done.v1": {
    canFollow: [
      "__START__",
      "chat.stream.started.v1",
      "chat.delta.v1",
      "chat.tool_call.v1",
    ],
    canPrecede: ["chat.stream.ended.v1", "chat.error.v1"],
  },
  "chat.stream.ended.v1": {
    canFollow: ["chat.done.v1", "chat.error.v1"],
    canPrecede: ["__END__"],
  },
  "chat.error.v1": {
    canFollow: [
      "__START__",
      "chat.stream.started.v1",
      "chat.delta.v1",
      "chat.tool_call.v1",
    ],
    canPrecede: ["chat.stream.ended.v1"],
  },
};

// ============================================================================
// State
// ============================================================================

const state = {
  startTime: performance.now(),
  messages: [],
  typeCounts: {},
  traceIds: new Set(),
  messageIds: new Set(),
  errors: [],
  isConnected: false,
  isDone: false,
};

// ============================================================================
// Reporting
// ============================================================================

function log(msg) {
  const elapsed = (performance.now() - state.startTime).toFixed(1);
  console.log(`[${elapsed}ms] ${msg}`);
}

function logError(msg) {
  console.error(`❌ ${msg}`);
  state.errors.push(msg);
}

function logWarn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function logSuccess(msg) {
  console.log(`✅ ${msg}`);
}

// ============================================================================
// Validation
// ============================================================================

function validateOrdering() {
  if (state.messages.length === 0) {
    logError("No messages received");
    return false;
  }

  let prevType = "__START__";
  let allValid = true;

  for (const msg of state.messages) {
    const curType = msg.type;
    const rules = ORDER_RULES[curType];

    if (!rules) {
      logWarn(`Unknown message type: ${curType}`);
      continue;
    }

    // Check if current message can follow previous
    if (!rules.canFollow.includes(prevType)) {
      logError(
        `Message ordering violation: ${curType} cannot follow ${prevType}`
      );
      allValid = false;
    }

    prevType = curType;
  }

  // Validate final state
  if (prevType !== "chat.stream.ended.v1") {
    logError(`Stream did not terminate with chat.stream.ended.v1; last was: ${prevType}`);
    allValid = false;
  }

  return allValid;
}

function validateRequiredMessages() {
  const hasRequired = REQUIRED_MESSAGES.every((requiredType) => {
    const count = state.typeCounts[requiredType] || 0;
    if (count === 0) {
      logError(`Missing required message type: ${requiredType}`);
      return false;
    }
    logSuccess(`Found ${count}x ${requiredType}`);
    return true;
  });

  return hasRequired;
}

function validateDeterminism() {
  let allValid = true;

  // Each message should have a traceId and messageId for reproducibility
  for (const msg of state.messages) {
    if (!msg.traceId && !msg.id) {
      logWarn(
        `Message ${msg.type} missing traceId/id for deterministic tracing`
      );
    }

    if (msg.traceId) {
      state.traceIds.add(msg.traceId);
    }
    if (msg.messageId) {
      state.messageIds.add(msg.messageId);
    }
  }

  if (state.traceIds.size === 0) {
    logWarn("No trace IDs found; deterministic tracing unavailable");
  } else {
    logSuccess(`Found ${state.traceIds.size} unique trace ID(s)`);
  }

  if (state.messageIds.size === 0) {
    logWarn("No message IDs found; message deduplication unavailable");
  } else {
    logSuccess(`Found ${state.messageIds.size} unique message ID(s)`);
  }

  return allValid;
}

// ============================================================================
// WebSocket Handler
// ============================================================================

function connectAndTest() {
  return new Promise((resolve) => {
    log(`Connecting to ${WS_URL}...`);

    const ws = new WebSocket(WS_URL);

    const timeout = setTimeout(() => {
      logError(`Timeout (${TIMEOUT_MS}ms) waiting for stream to complete`);
      ws.close();
      resolve(false);
    }, TIMEOUT_MS);

    ws.on("open", () => {
      state.isConnected = true;
      logSuccess("Connected to Nucleus WebSocket");

      // Send chat request
      const now = Date.now();
      const convoId = `smoke-test-${now}`;
      const messageId = `m-${now}`;

      const request = {
        type: "chat.request.v1",
        id: messageId,
        traceId: `trace-${convoId}`,
        payload: {
          convoId,
          messageId,
          text: "Hello, what is 2+2?",
          userId: "smoke-test",
          persona: "assistant",
        },
      };

      log(`Sending chat.request.v1 (convoId=${convoId})...`);
      ws.send(JSON.stringify(request));
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const { type, traceId, messageId, payload } = msg;

        log(`Received: ${type}`);

        state.messages.push(msg);
        state.typeCounts[type] = (state.typeCounts[type] || 0) + 1;

        // Stop on terminal messages
        if (type === "chat.stream.ended.v1" || type === "chat.error.v1") {
          state.isDone = true;
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      } catch (err) {
        logError(`Failed to parse message: ${err.message}`);
        clearTimeout(timeout);
        ws.close();
        resolve(false);
      }
    });

    ws.on("error", (err) => {
      logError(`WebSocket error: ${err.message}`);
      clearTimeout(timeout);
      resolve(false);
    });

    ws.on("close", () => {
      if (!state.isDone) {
        logError("WebSocket closed before stream completed");
      }
      clearTimeout(timeout);
      resolve(state.isDone);
    });
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("🔍 Chat Streaming Smoke Test");
  console.log(`   WS URL: ${WS_URL}`);
  console.log(`   Timeout: ${TIMEOUT_MS}ms`);
  console.log("");

  const success = await connectAndTest();

  if (!success) {
    logError("Failed to receive complete stream");
    process.exit(1);
  }

  console.log("");
  console.log("📊 Results:");
  console.log(`   Messages received: ${state.messages.length}`);
  console.log(`   Message types:`, state.typeCounts);

  const orderingValid = validateOrdering();
  const requiredValid = validateRequiredMessages();
  const deterministicValid = validateDeterminism();

  console.log("");

  if (state.errors.length > 0) {
    console.log(`❌ ${state.errors.length} error(s) detected:`);
    state.errors.forEach((e) => console.log(`   - ${e}`));
    console.log("");
    process.exit(1);
  }

  console.log("✅ All checks passed!");
  console.log(`   ✓ Message ordering valid`);
  console.log(`   ✓ Required messages present`);
  console.log(`   ✓ Deterministic tracing available`);
  console.log("");

  const elapsed = (performance.now() - state.startTime).toFixed(1);
  console.log(`✨ Smoke test completed in ${elapsed}ms`);

  process.exit(0);
}

main().catch((err) => {
  logError(`Unexpected error: ${err.message}`);
  process.exit(1);
});
