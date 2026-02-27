// server/ledger.ts
// Append-only, hash-chained ledger (NDJSON format)

import fs from "node:fs/promises";
import path from "node:path";
import { sha256Hex, stableStringify, type Json } from "../src/shared/stable.js";

export interface LedgerEventInput {
  type: string; // e.g. "artifact.write"
  doc_id: string;
  artifact_id?: string;
  payload?: Json; // small metadata only
}

export interface LedgerEntry {
  seq: number;
  ts_utc: string;
  type: string;
  doc_id: string;
  artifact_id?: string;

  payload?: Json;
  payload_hash: string;

  prev_hash: string; // "0" for genesis
  entry_hash: string; // sha256(prev_hash + "\n" + stableStringify(entry_without_entry_hash))
}

export interface LedgerState {
  filePath: string;
  maxSeq: number;
  lastHash: string;
}

function utcNowIso(): string {
  return new Date().toISOString();
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readLastNonEmptyLine(filePath: string): Promise<string | null> {
  if (!(await fileExists(filePath))) return null;
  const buf = await fs.readFile(filePath, "utf8");
  const lines = buf.split("\n").map((x) => x.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return lines[lines.length - 1];
}

export class HashChainedLedger {
  private state: LedgerState;

  constructor(filePath: string) {
    this.state = { filePath, maxSeq: 0, lastHash: "0" };
  }

  async init(): Promise<LedgerState> {
    await ensureDir(path.dirname(this.state.filePath));
    const last = await readLastNonEmptyLine(this.state.filePath);
    if (!last) return this.state;

    const parsed = JSON.parse(last) as LedgerEntry;
    this.state.maxSeq = parsed.seq;
    this.state.lastHash = parsed.entry_hash;
    return this.state;
  }

  status(): LedgerState {
    return { ...this.state };
  }

  async append(ev: LedgerEventInput): Promise<LedgerEntry> {
    const ts_utc = utcNowIso();
    const payload = ev.payload ?? null;

    const payload_hash = sha256Hex(stableStringify(payload as Json));

    const seq = this.state.maxSeq + 1;
    const prev_hash = this.state.lastHash || "0";

    // Entry WITHOUT entry_hash (deterministic hash preimage)
    const base: Omit<LedgerEntry, "entry_hash"> = {
      seq,
      ts_utc,
      type: ev.type,
      doc_id: ev.doc_id,
      artifact_id: ev.artifact_id,
      payload: payload as Json,
      payload_hash,
      prev_hash
    };

    const entry_hash = sha256Hex(prev_hash + "\n" + stableStringify(base as unknown as Json));
    const full: LedgerEntry = { ...base, entry_hash };

    await fs.appendFile(this.state.filePath, JSON.stringify(full) + "\n", "utf8");

    this.state.maxSeq = seq;
    this.state.lastHash = entry_hash;
    return full;
  }

  async range(start: number, end: number): Promise<LedgerEntry[]> {
    const buf = await fs.readFile(this.state.filePath, "utf8").catch(() => "");
    const lines = buf.split("\n").map((x) => x.trim()).filter(Boolean);
    const out: LedgerEntry[] = [];
    for (const line of lines) {
      const e = JSON.parse(line) as LedgerEntry;
      if (e.seq >= start && e.seq <= end) out.push(e);
    }
    return out;
  }

  async stream(afterSeq: number, limit = 200): Promise<LedgerEntry[]> {
    const buf = await fs.readFile(this.state.filePath, "utf8").catch(() => "");
    const lines = buf.split("\n").map((x) => x.trim()).filter(Boolean);
    const out: LedgerEntry[] = [];
    for (const line of lines) {
      const e = JSON.parse(line) as LedgerEntry;
      if (e.seq > afterSeq) out.push(e);
      if (out.length >= limit) break;
    }
    return out;
  }
}
