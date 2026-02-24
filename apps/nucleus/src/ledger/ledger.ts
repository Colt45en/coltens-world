/**
 * NUCLEUS LEDGER MODULE
 *
 * Append-only event ledger running inside Nucleus.
 * Serves as the single source of truth for tool execution, approvals, and audit trail.
 *
 * Endpoints:
 * - POST /ledger/append → append event(s)
 * - GET /ledger/stream?after_seq=N → get events after seq N
 * - GET /ledger/range?start_seq=N&end_seq=M → get event range
 * - GET /ledger/call/:call_id → get all events for a call_id
 * - POST /ledger/checkpoint → record checkpoint for replay
 */

import Database from 'better-sqlite3';
import crypto from 'node:crypto';

// Inline SCHEMA_INIT since module importing is problematic
const SCHEMA_EVENTS = `
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK (seq > 0)
);
CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id);
CREATE INDEX IF NOT EXISTS idx_events_call_id ON events(call_id);
`;

const SCHEMA_INIT = SCHEMA_EVENTS;

export type AnyEvent = Record<string, unknown>;

export interface LedgerConfig {
  db_path: string;
  enable_wal?: boolean;
}

/**
 * Ledger: the authoritative append-only timeline.
 */
export class Ledger {
  private db: InstanceType<typeof Database>;
  private readonly config: LedgerConfig;

  constructor(config: LedgerConfig) {
    this.config = config;
    this.db = new Database(config.db_path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.init();
  }

  /**
   * Initialize schema.
   */
  public init(): void {
    const statements = SCHEMA_INIT.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      this.db.exec(stmt);
    }
  }

  /**
   * Append an event to the ledger.
   * Returns the assigned seq number.
   *
   * @throws if event_id already exists (duplicate)
   */
  public append(event: Omit<AnyEvent, 'seq'>): number {
    const payload_hash = this.computePayloadHash(event.payload);

    const stmt = this.db.prepare(`
      INSERT INTO events (event_id, type, v, ts, correlation_id, call_id, producer, payload_hash, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING seq;
    `);

    const result = stmt.get(
      event.event_id,
      event.type,
      event.v,
      event.ts,
      event.correlation_id,
      event.call_id ?? null,
      event.producer,
      payload_hash,
      JSON.stringify(event.payload)
    ) as { seq: number };

    return result.seq;
  }

  /**
   * Append multiple events in a transaction.
   * All succeed or all fail.
   */
  public appendBatch(events: Array<Omit<AnyEvent, 'seq'>>): number[] {
    const transaction = this.db.transaction((evts: Array<Omit<AnyEvent, 'seq'>>) => {
      return evts.map(e => this.append(e));
    });

    return transaction(events);
  }

  /**
   * Stream events after a given seq (for subscriptions).
   */
  public stream(after_seq: number, limit: number = 100): AnyEvent[] {
    const stmt = this.db.prepare(`
      SELECT seq, event_id, type, v, ts, correlation_id, call_id, producer, payload_hash,
             payload_json FROM events
      WHERE seq > ?
      ORDER BY seq ASC
      LIMIT ?
    `);

    const rows = stmt.all(after_seq, limit) as Array<{
      seq: number;
      payload_json: string;
      [key: string]: any;
    }>;

    return rows.map((row) => this.rowToEvent(row));
  }

  /**
   * Get event range.
   */
  public range(start_seq: number, end_seq: number): AnyEvent[] {
    const stmt = this.db.prepare(`
      SELECT seq, event_id, type, v, ts, correlation_id, call_id, producer, payload_hash,
             payload_json FROM events
      WHERE seq >= ? AND seq <= ?
      ORDER BY seq ASC
    `);

    const rows = stmt.all(start_seq, end_seq) as Array<{
      seq: number;
      payload_json: string;
      [key: string]: any;
    }>;

    return rows.map((row) => this.rowToEvent(row));
  }

  /**
   * Get all events for a call_id (reconstruct tool execution).
   */
  public callHistory(call_id: string): AnyEvent[] {
    const stmt = this.db.prepare(`
      SELECT seq, event_id, type, v, ts, correlation_id, call_id, producer, payload_hash,
             payload_json FROM events
      WHERE call_id = ?
      ORDER BY seq ASC
    `);

    const rows = stmt.all(call_id) as Array<{
      seq: number;
      payload_json: string;
      [key: string]: any;
    }>;

    return rows.map((row) => this.rowToEvent(row));
  }

  /**
   * Get current max seq (for "where am I" queries).
   */
  public maxSeq(): number {
    const result = this.db.prepare('SELECT MAX(seq) as max_seq FROM events').get() as { max_seq: number | null };
    return result.max_seq ?? 0;
  }

  /**
   * Record a checkpoint (for replay verification).
   */
  public recordCheckpoint(seq: number, hash: string, artifact_root?: string): void {
    this.db.prepare(`
      INSERT INTO checkpoints (seq, hash, artifact_root, mode)
      VALUES (?, ?, ?, 'record')
    `).run(seq, hash, artifact_root ?? null);
  }

  /**
   * Update call state in the call graph.
   */
  public updateCallState(call_id: string, state: string): void {
    this.db.prepare(`
      UPDATE call_graph SET state = ?, updated_at = CURRENT_TIMESTAMP
      WHERE call_id = ?
    `).run(state, call_id);
  }

  /**
   * Get a single event by event_id.
   */
  public getEvent(event_id: string): AnyEvent | null {
    const row = this.db.prepare(`
      SELECT seq, event_id, type, v, ts, correlation_id, call_id, producer, payload_hash,
             payload_json FROM events
      WHERE event_id = ?
    `).get(event_id) as { seq: number; payload_json: string; [key: string]: any } | undefined;

    if (!row) return null;
    return this.rowToEvent(row);
  }

  /**
   * Get the rolling hash of events in a range (for checksums).
   */
  public rangeHash(start_seq: number, end_seq: number): string {
    const result = this.db.prepare(`
      SELECT GROUP_CONCAT(payload_hash, '') as concatenated
      FROM events
      WHERE seq >= ? AND seq <= ?
    `).get(start_seq, end_seq) as { concatenated: string | null };

    if (!result.concatenated) return '';
    return crypto.createHash('sha256').update(result.concatenated).digest('hex');
  }

  /**
   * Compute SHA256 of canonical JSON payload.
   */
  public computePayloadHash(payload: unknown): string {
    const canonical = stableCanonicalJson(payload);
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  private rowToEvent(
    row: { payload_json: string; [key: string]: any }
  ): AnyEvent {
    const { payload_json, ...rest } = row;
    return {
      ...(rest as Omit<AnyEvent, 'payload'>),
      payload: JSON.parse(payload_json),
    } as AnyEvent;
  }

  /**
   * Close the database.
   */
  public close(): void {
    this.db.close();
  }
}

function stableCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableCanonicalJson(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableCanonicalJson(obj[k])}`).join(',')}}`;
}

/**
 * REST API handlers (for Express integration in Nucleus).
 */
export function createLedgerRoutes(ledger: Ledger) {
  return {
    /**
     * POST /ledger/append
     * Append one or more events.
     */
    append: async (req: any, res: any) => {
      try {
        const body = req.body;
        const events = Array.isArray(body) ? body : [body];

        const seqs = ledger.appendBatch(events);
        res.json({
          success: true,
          seqs,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    },

    /**
     * GET /ledger/stream?after_seq=N
     * Stream events after seq N.
     */
    stream: async (req: any, res: any) => {
      try {
        const after_seq = parseInt(req.query.after_seq ?? '0', 10);
        const limit = parseInt(req.query.limit ?? '100', 10);
        const events = ledger.stream(after_seq, limit);

        res.json({
          success: true,
          events,
          max_seq: ledger.maxSeq(),
        });
      } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
      }
    },

    /**
     * GET /ledger/range?start_seq=...&end_seq=...
     */
    range: async (req: any, res: any) => {
      try {
        const start_seq = parseInt(req.query.start_seq ?? '0', 10);
        const end_seq = parseInt(req.query.end_seq ?? '999999', 10);
        const events = ledger.range(start_seq, end_seq);

        res.json({
          success: true,
          events,
        });
      } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
      }
    },

    /**
     * GET /ledger/call/:call_id
     * Get all events for a call_id.
     */
    callHistory: async (req: any, res: any) => {
      try {
        const call_id = req.params.call_id;
        const events = ledger.callHistory(call_id);

        res.json({
          success: true,
          call_id,
          events,
        });
      } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
      }
    },

    /**
     * GET /ledger/status
     * Health check + current state.
     */
    status: async (req: any, res: any) => {
      try {
        const max_seq = ledger.maxSeq();
        res.json({
          success: true,
          ledger_status: 'ok',
          max_seq,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    },
  };
}
