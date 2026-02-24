/**
 * LEDGER DB SCHEMA v1
 *
 * SQLite schema for the deterministic append-only event ledger.
 * Core tables: events, call_graph, outbox, idempotency keys.
 */

// ============================================================================
// MAIN LEDGER TABLE (append-only, monotonically sequenced)
// ============================================================================

export const SCHEMA_EVENTS = `
CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  v INTEGER NOT NULL,
  ts TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  call_id TEXT,
  producer TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Indices
  CHECK (seq > 0)
);

CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id);
CREATE INDEX IF NOT EXISTS idx_events_call_id ON events(call_id) WHERE call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_producer ON events(producer);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
`;

// ============================================================================
// CALL GRAPH (tool execution causality)
// ============================================================================

export const SCHEMA_CALL_GRAPH = `
CREATE TABLE IF NOT EXISTS call_graph (
  call_id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  effect_profile TEXT NOT NULL,
  determinism_policy TEXT NOT NULL,
  approval_required INTEGER DEFAULT 0,
  approval_id TEXT,

  -- State machine
  state TEXT NOT NULL DEFAULT 'pending',
  -- States: pending → approved|rejected → executing → result|error

  -- Timing
  request_seq INTEGER,
  approval_decision_seq INTEGER,
  result_seq INTEGER,

  -- Artifacts
  input_hash TEXT,
  output_hash TEXT,
  artifact_dir TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  CHECK (state IN ('pending', 'approved', 'rejected', 'executing', 'result', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_call_graph_correlation_id ON call_graph(correlation_id);
CREATE INDEX IF NOT EXISTS idx_call_graph_state ON call_graph(state);
CREATE INDEX IF NOT EXISTS idx_call_graph_approval_id ON call_graph(approval_id) WHERE approval_id IS NOT NULL;
`;

// ============================================================================
// OUTBOX (ensures at-least-once delivery of events to ledger)
// ============================================================================

export const SCHEMA_OUTBOX = `
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  producer TEXT NOT NULL,
  payload_json TEXT NOT NULL,

  -- State
  status TEXT NOT NULL DEFAULT 'pending',
  -- Status: pending → sent → confirmed

  attempt_count INTEGER DEFAULT 0,
  last_attempt_at DATETIME,
  last_error TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  CHECK (status IN ('pending', 'sent', 'confirmed'))
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
CREATE INDEX IF NOT EXISTS idx_outbox_event_id ON outbox(event_id);
`;

// ============================================================================
// IDEMPOTENCY (prevent duplicate processing)
// ============================================================================

export const SCHEMA_IDEMPOTENCY = `
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  handler TEXT NOT NULL,
  result_json TEXT,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idempotency_event_id ON idempotency_keys(event_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_handler ON idempotency_keys(handler);
`;

// ============================================================================
// ARTIFACT STORE (references to serialized tool outputs for replay)
// ============================================================================

export const SCHEMA_ARTIFACTS = `
CREATE TABLE IF NOT EXISTS artifacts (
  hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  call_id TEXT,
  content_length INTEGER,
  content_type TEXT,

  -- Path where the artifact is stored (relative to artifact root)
  path_rel TEXT NOT NULL UNIQUE,

  -- For external tools, store the raw bytes (or reference URI)
  data BLOB,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artifacts_call_id ON artifacts(call_id) WHERE call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artifacts_kind ON artifacts(kind);
`;

// ============================================================================
// REPLAY CHECKPOINTS (for tracking replay progress)
// ============================================================================

export const SCHEMA_CHECKPOINTS = `
CREATE TABLE IF NOT EXISTS checkpoints (
  seq INTEGER PRIMARY KEY,
  hash TEXT NOT NULL,
  artifact_root TEXT,
  mode TEXT NOT NULL,
  -- Mode: record|replay

  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_mode ON checkpoints(mode);
`;

// ============================================================================
// COMBINED MIGRATION (all tables)
// ============================================================================

export const SCHEMA_INIT = `
${SCHEMA_EVENTS}

${SCHEMA_CALL_GRAPH}

${SCHEMA_OUTBOX}

${SCHEMA_IDEMPOTENCY}

${SCHEMA_ARTIFACTS}

${SCHEMA_CHECKPOINTS}
`;

// ============================================================================
// QUERIES (common operations)
// ============================================================================

export const QUERIES = {
  /**
   * Append an event atomically.
   * Returns the assigned seq number.
   */
  appendEvent: `
    INSERT INTO events (event_id, type, v, ts, correlation_id, call_id, producer, payload_hash, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING seq;
  `,

  /**
   * Stream events after a given seq (for subscriptions)
   */
  streamAfter: `
    SELECT * FROM events WHERE seq > ? ORDER BY seq ASC LIMIT ?;
  `,

  /**
   * Get all events for a call_id (reconstruct tool execution)
   */
  callHistory: `
    SELECT * FROM events WHERE call_id = ? ORDER BY seq ASC;
  `,

  /**
   * Confirm outbox delivery (acknowledge that ledger received it)
   */
  confirmOutbox: `
    UPDATE outbox SET status = 'confirmed' WHERE event_id = ?;
  `,

  /**
   * Record idempotency key (prevent duplicate processing)
   */
  recordIdempotency: `
    INSERT OR IGNORE INTO idempotency_keys (key, event_id, handler, result_json)
    VALUES (?, ?, ?, ?);
  `,

  /**
   * Check if event was already processed
   */
  checkIdempotency: `
    SELECT result_json FROM idempotency_keys WHERE key = ?;
  `,

  /**
   * Update call state in the graph
   */
  updateCallState: `
    UPDATE call_graph SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE call_id = ?;
  `,

  /**
   * Get current seq (for next append)
   */
  maxSeq: `
    SELECT MAX(seq) as max_seq FROM events;
  `,

  /**
   * Rolling hash for checkpoint (simplified; in production use Merkle)
   */
  hashRange: `
    SELECT GROUP_CONCAT(payload_hash, '') as rolled FROM events WHERE seq BETWEEN ? AND ?;
  `,
};
