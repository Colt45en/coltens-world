import type {
    LedgerEntry,
    LedgerEventInput,
    LedgerStatus,
    LedgerVerifyResult,
} from "@world-engine/engine/contracts/ledger";
import fs from "node:fs/promises";
import path from "node:path";
import { sha256Hex, stableStringify, utcNowIso, type Json } from "./stable";

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
  return lines[lines.length - 1] ?? null;
}

export class HashChainedLedger {
  private filePath: string;
  private maxSeq = 0;
  private lastHash = "0";

  // single-writer async queue (prevents race conditions on append)
  private queue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async init(): Promise<LedgerStatus> {
    await ensureDir(path.dirname(this.filePath));
    const last = await readLastNonEmptyLine(this.filePath);
    if (last) {
      const parsed = JSON.parse(last) as LedgerEntry;
      this.maxSeq = parsed.seq;
      this.lastHash = parsed.entry_hash;
    }
    return this.status();
  }

  status(): LedgerStatus {
    return { filePath: this.filePath, maxSeq: this.maxSeq, lastHash: this.lastHash };
  }

  async append(ev: LedgerEventInput): Promise<LedgerEntry> {
    return await this.enqueue(async () => {
      const ts_utc = utcNowIso();
      const payload = (ev.payload ?? null) as Json;
      const payload_hash = sha256Hex(stableStringify(payload));

      const seq = this.maxSeq + 1;
      const prev_hash = this.lastHash || "0";

      // Entry WITHOUT entry_hash (deterministic hash preimage)
      const base: Omit<LedgerEntry, "entry_hash"> = {
        seq,
        ts_utc,
        type: ev.type,
        doc_id: ev.doc_id,
        artifact_id: ev.artifact_id,
        payload,
        payload_hash,
        prev_hash,
      };

      const entry_hash = sha256Hex(prev_hash + "\n" + stableStringify(base as unknown as Json));
      const full: LedgerEntry = { ...base, entry_hash };

      await fs.appendFile(this.filePath, JSON.stringify(full) + "\n", "utf8");

      this.maxSeq = seq;
      this.lastHash = entry_hash;
      return full;
    });
  }

  async range(start: number, end: number): Promise<LedgerEntry[]> {
    const buf = await fs.readFile(this.filePath, "utf8").catch(() => "");
    const lines = buf.split("\n").map((x) => x.trim()).filter(Boolean);
    const out: LedgerEntry[] = [];
    for (const line of lines) {
      const e = JSON.parse(line) as LedgerEntry;
      if (e.seq >= start && e.seq <= end) out.push(e);
    }
    return out;
  }

  async stream(afterSeq: number, limit = 200): Promise<LedgerEntry[]> {
    const buf = await fs.readFile(this.filePath, "utf8").catch(() => "");
    const lines = buf.split("\n").map((x) => x.trim()).filter(Boolean);
    const out: LedgerEntry[] = [];
    for (const line of lines) {
      const e = JSON.parse(line) as LedgerEntry;
      if (e.seq > afterSeq) out.push(e);
      if (out.length >= limit) break;
    }
    return out;
  }

  async verify(): Promise<LedgerVerifyResult> {
    const buf = await fs.readFile(this.filePath, "utf8").catch(() => "");
    const lines = buf.split("\n").map((x) => x.trim()).filter(Boolean);

    let prev = "0";
    let expectedSeq = 1;

    for (const line of lines) {
      const e = JSON.parse(line) as LedgerEntry;

      if (e.seq !== expectedSeq) {
        return {
          ok: false,
          checked: expectedSeq - 1,
          bad_seq: e.seq,
          reason: `seq gap: expected ${expectedSeq}, got ${e.seq}`,
        };
      }

      if (e.prev_hash !== prev) {
        return {
          ok: false,
          checked: expectedSeq - 1,
          bad_seq: e.seq,
          reason: "prev_hash mismatch",
        };
      }

      const base: Omit<LedgerEntry, "entry_hash"> = {
        seq: e.seq,
        ts_utc: e.ts_utc,
        type: e.type,
        doc_id: e.doc_id,
        artifact_id: e.artifact_id,
        payload: (e.payload ?? null) as Json,
        payload_hash: e.payload_hash,
        prev_hash: e.prev_hash,
      };

      const recomputed = sha256Hex(prev + "\n" + stableStringify(base as unknown as Json));
      if (recomputed !== e.entry_hash) {
        return {
          ok: false,
          checked: expectedSeq - 1,
          bad_seq: e.seq,
          reason: "entry_hash mismatch",
        };
      }

      prev = e.entry_hash;
      expectedSeq++;
    }

    return { ok: true, checked: lines.length };
  }

  /**
   * Async queue: ensures single-writer (sequential appends)
   */
  private async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    let resolveOut!: (v: T) => void;
    let rejectOut!: (e: any) => void;
    const out = new Promise<T>((resolve, reject) => {
      resolveOut = resolve;
      rejectOut = reject;
    });

    this.queue = this.queue
      .then(async () => {
        try {
          const v = await fn();
          resolveOut(v);
        } catch (e) {
          rejectOut(e);
        }
      })
      .catch(() => {
        // keep queue alive even if a task threw
      });

    return out;
  }
}
