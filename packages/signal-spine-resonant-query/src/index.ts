
import { SignalError, stableStringify, fnv1a64Hex } from "@world-engine/signal-spine-contract";
import type {
  ResonantGraphSnapshot,
  GraphNode,
  GraphEdge,
  NodeId,
  EdgeId,
  EdgeKind,
} from "@world-engine/signal-spine-resonant-graph";

/* -------------------------------- NDJSON -------------------------------- */

export type NdjsonRecord =
  | { type: "snapshot"; schema_version: "1.0.0"; graph_id: string; created_at_utc: string }
  | { type: "node"; graph_id: string; node: GraphNode }
  | { type: "edge"; graph_id: string; edge: GraphEdge };

export function encodeNdjson(rec: NdjsonRecord): string {
  return `${stableStringify(rec)}\n`;
}

export function decodeNdjsonLine(line: string): NdjsonRecord | null {
  const s = line.trim();
  if (!s) return null;
  const obj = JSON.parse(s);
  if (!obj || typeof obj !== "object") throw new SignalError("E_INVALID", "NDJSON record must be an object");
  if ((obj as { type?: string }).type !== "snapshot" && (obj as { type?: string }).type !== "node" && (obj as { type?: string }).type !== "edge") {
    throw new SignalError("E_INVALID", `Unknown NDJSON record type: ${String((obj as { type?: string }).type)}`);
  }
  return obj as NdjsonRecord;
}

/* ------------------------------- Store API ------------------------------ */

export interface NdjsonIO {
  readText(path: string): Promise<string>;
  appendText(path: string, content: string): Promise<void>;
  writeText(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface NdjsonTailIO {
  readBytes(path: string, byteOffset: number, maxBytes?: number): Promise<{ text: string; newOffset: number; eof: boolean }>;
}

export function makeGraphNdjsonRecords(snapshot: ResonantGraphSnapshot): NdjsonRecord[] {
  const out: NdjsonRecord[] = [];
  out.push({
    type: "snapshot",
    schema_version: "1.0.0",
    graph_id: snapshot.graph_id,
    created_at_utc: snapshot.created_at_utc,
  });
  for (const node of snapshot.nodes) out.push({ type: "node", graph_id: snapshot.graph_id, node });
  for (const edge of snapshot.edges) out.push({ type: "edge", graph_id: snapshot.graph_id, edge });
  return out;
}

export async function appendSnapshotToNdjson(io: NdjsonIO, path: string, snapshot: ResonantGraphSnapshot): Promise<void> {
  const recs = makeGraphNdjsonRecords(snapshot);
  const text = recs.map(encodeNdjson).join("");
  await io.appendText(path, text);
}

export async function writeSnapshotToNdjson(io: NdjsonIO, path: string, snapshot: ResonantGraphSnapshot): Promise<void> {
  const recs = makeGraphNdjsonRecords(snapshot);
  const text = recs.map(encodeNdjson).join("");
  await io.writeText(path, text);
}

/* -------------------------------- Index -------------------------------- */

export type GraphIndex = Readonly<{
  graph_id: string;
  created_at_utc: string;
  nodesById: Map<NodeId, GraphNode>;
  edgesById: Map<EdgeId, GraphEdge>;
  outEdges: Map<NodeId, GraphEdge[]>;
  inEdges: Map<NodeId, GraphEdge[]>;
}>;

export type MutableGraphIndex = {
  graph_id: string;
  created_at_utc: string;
  nodesById: Map<NodeId, GraphNode>;
  edgesById: Map<EdgeId, GraphEdge>;
  outEdges: Map<NodeId, GraphEdge[]>;
  inEdges: Map<NodeId, GraphEdge[]>;
};

export function buildIndexFromSnapshot(snapshot: ResonantGraphSnapshot): GraphIndex {
  return createMutableIndexFromSnapshot(snapshot);
}

export function createMutableIndexFromSnapshot(snapshot: ResonantGraphSnapshot): MutableGraphIndex {
  const idx: MutableGraphIndex = {
    graph_id: snapshot.graph_id,
    created_at_utc: snapshot.created_at_utc,
    nodesById: new Map<NodeId, GraphNode>(),
    edgesById: new Map<EdgeId, GraphEdge>(),
    outEdges: new Map<NodeId, GraphEdge[]>(),
    inEdges: new Map<NodeId, GraphEdge[]>(),
  };

  for (const n of snapshot.nodes) idx.nodesById.set(n.id, n);

  for (const e of snapshot.edges) {
    idx.edgesById.set(e.id, e);
    insertAdjEdge(idx.outEdges, e.from, e);
    insertAdjEdge(idx.inEdges, e.to, e);
  }

  return idx;
}

function insertAdjEdge(map: Map<NodeId, GraphEdge[]>, nodeId: NodeId, edge: GraphEdge): void {
  let arr = map.get(nodeId);
  if (!arr) {
    arr = [];
    map.set(nodeId, arr);
  }

  const i = lowerBoundEdgeId(arr, edge.id);
  if (i < arr.length && arr[i].id === edge.id) {
    arr[i] = edge;
    return;
  }

  arr.splice(i, 0, edge);
}

function removeAdjEdge(map: Map<NodeId, GraphEdge[]>, nodeId: NodeId, edgeId: EdgeId): void {
  const arr = map.get(nodeId);
  if (!arr || arr.length === 0) return;

  const i = lowerBoundEdgeId(arr, edgeId);
  if (i < arr.length && arr[i].id === edgeId) {
    arr.splice(i, 1);
  }
}

function lowerBoundEdgeId(arr: GraphEdge[], edgeId: string): number {
  let lo = 0;
  let hi = arr.length;

  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].id < edgeId) lo = mid + 1;
    else hi = mid;
  }

  return lo;
}

export async function loadLatestSnapshotIndexFromNdjson(io: NdjsonIO, path: string): Promise<GraphIndex> {
  const { index } = await loadLatestSnapshotIndexAndCursor(io, path);
  return index;
}

export async function loadLatestSnapshotIndexAndCursor(io: NdjsonIO, path: string): Promise<{ index: GraphIndex; cursor: IncrementalCursor }> {
  if (!(await io.exists(path))) throw new SignalError("E_INVALID", `NDJSON not found: ${path}`);

  const text = await io.readText(path);
  const buf = Buffer.from(text, "utf8");
  const lines = text.split(/\r?\n/);

  let latestSnap: { graph_id: string; created_at_utc: string; lineIndex: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rec = decodeNdjsonLine(lines[i]);
    if (!rec) continue;
    if (rec.type === "snapshot") {
      if (!latestSnap || rec.created_at_utc > latestSnap.created_at_utc) {
        latestSnap = { graph_id: rec.graph_id, created_at_utc: rec.created_at_utc, lineIndex: i };
      }
    }
  }

  if (!latestSnap) throw new SignalError("E_INVALID", "No snapshot records found in NDJSON");

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const line of lines) {
    const rec = decodeNdjsonLine(line);
    if (!rec) continue;
    if (rec.type === "node" && rec.graph_id === latestSnap.graph_id) nodes.push(rec.node);
    if (rec.type === "edge" && rec.graph_id === latestSnap.graph_id) edges.push(rec.edge);
  }

  nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
  edges.sort((a, b) => (a.id < b.id ? -1 : 1));

  const snapshot: ResonantGraphSnapshot = {
    schema_version: "1.0.0",
    graph_id: latestSnap.graph_id,
    created_at_utc: latestSnap.created_at_utc,
    nodes,
    edges,
  };

  const index = buildIndexFromSnapshot(snapshot);
  const cursor: IncrementalCursor = {
    byteOffset: buf.length,
    carry: "",
    active: { graph_id: index.graph_id, created_at_utc: index.created_at_utc },
  };

  return { index, cursor };
}

export async function loadLatestSnapshotCursor(io: NdjsonIO, path: string): Promise<IncrementalCursor> {
  if (!(await io.exists(path))) throw new SignalError("E_INVALID", `NDJSON not found: ${path}`);
  const text = await io.readText(path);
  const lines = text.split(/\r?\n/);

  let latestSnap: { graph_id: string; created_at_utc: string; byteOffset: number } | null = null;

  let runningBytes = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rec = decodeNdjsonLine(line);
    const lineBytes = Buffer.from(line + "\n", "utf8").length;
    if (rec && rec.type === "snapshot") {
      if (!latestSnap || rec.created_at_utc > latestSnap.created_at_utc) {
        latestSnap = { graph_id: rec.graph_id, created_at_utc: rec.created_at_utc, byteOffset: runningBytes };
      }
    }
    runningBytes += lineBytes;
  }

  if (!latestSnap) throw new SignalError("E_INVALID", "No snapshot records found in NDJSON");

  return {
    byteOffset: latestSnap.byteOffset,
    carry: "",
    active: { graph_id: latestSnap.graph_id, created_at_utc: latestSnap.created_at_utc },
  };
}

/* ------------------------ Incremental NDJSON Ingest --------------------- */

export type IncrementalCursor = {
  byteOffset: number;
  carry: string;
  active: { graph_id: string; created_at_utc: string } | null;
};

export function applyNdjsonRecordToIndex(
  idx: MutableGraphIndex,
  cursor: IncrementalCursor,
  rec: NdjsonRecord
): { reset: boolean } {
  if (rec.type === "snapshot") {
    const active = cursor.active;
    if (!active || rec.created_at_utc > active.created_at_utc) {
      cursor.active = { graph_id: rec.graph_id, created_at_utc: rec.created_at_utc };

      idx.graph_id = rec.graph_id;
      idx.created_at_utc = rec.created_at_utc;
      idx.nodesById.clear();
      idx.edgesById.clear();
      idx.outEdges.clear();
      idx.inEdges.clear();

      return { reset: true };
    }

    return { reset: false };
  }

  const active = cursor.active;
  if (!active) return { reset: false };
  if (rec.graph_id !== active.graph_id) return { reset: false };

  if (rec.type === "node") {
    idx.nodesById.set(rec.node.id, rec.node);
    return { reset: false };
  }

  const e = rec.edge;
  const prev = idx.edgesById.get(e.id);
  if (prev) {
    if (prev.from !== e.from) removeAdjEdge(idx.outEdges, prev.from, prev.id);
    if (prev.to !== e.to) removeAdjEdge(idx.inEdges, prev.to, prev.id);
  }

  idx.edgesById.set(e.id, e);
  insertAdjEdge(idx.outEdges, e.from, e);
  insertAdjEdge(idx.inEdges, e.to, e);

  return { reset: false };
}

export async function ingestNdjsonIncremental(
  io: NdjsonIO & Partial<NdjsonTailIO>,
  path: string,
  idx: MutableGraphIndex,
  cursor: IncrementalCursor,
  opts?: { maxBytesPerRead?: number; maxReads?: number }
): Promise<{ appliedRecords: number; sawReset: boolean; eof: boolean }> {
  if (!io.readBytes) {
    throw new SignalError("E_INVALID", "ingestNdjsonIncremental requires io.readBytes (NdjsonTailIO)");
  }

  const maxBytes = opts?.maxBytesPerRead ?? (1 << 20);
  const maxReads = opts?.maxReads ?? 64;

  let applied = 0;
  let sawReset = false;
  let eof = false;

  for (let r = 0; r < maxReads; r++) {
    const { text, newOffset, eof: chunkEof } = await io.readBytes(path, cursor.byteOffset, maxBytes);
    cursor.byteOffset = newOffset;
    eof = chunkEof;

    if (!text) break;

    const combined = cursor.carry + text;
    const lines = combined.split(/\r?\n/);
    cursor.carry = lines.pop() ?? "";

    for (const line of lines) {
      const rec = decodeNdjsonLine(line);
      if (!rec) continue;

      const res = applyNdjsonRecordToIndex(idx, cursor, rec);
      if (res.reset) sawReset = true;

      if ((rec.type === "node" || rec.type === "edge") && cursor.active && rec.graph_id === cursor.active.graph_id) {
        applied++;
      }
    }

    if (eof) break;
  }

  return { appliedRecords: applied, sawReset, eof };
}

/* ------------------------------- Query DSL ------------------------------ */

type Token =
  | { t: "word"; v: string }
  | { t: "string"; v: string }
  | { t: "number"; v: number }
  | { t: "op"; v: "==" | "!=" | ">=" | "<=" | ">" | "<" | "," | ":" | "." | "(" | ")" | "=" }
  | { t: "eof" };

function tokenize(input: string): Token[] {
  const s = input.trim();
  const out: Token[] = [];
  let i = 0;

  const isWs = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";
  const isAlpha = (c: string) => /[A-Za-z_]/.test(c);
  const isAlnum = (c: string) => /[A-Za-z0-9_-]/.test(c);
  const isDigit = (c: string) => /[0-9]/.test(c);

  while (i < s.length) {
    const c = s[i] as string;

    if (isWs(c)) {
      i++;
      continue;
    }

    if (c === `"`) {
      i++;
      let buf = "";
      while (i < s.length && s[i] !== `"`) {
        if (s[i] === "\\" && i + 1 < s.length) {
          const esc = s[i + 1] as string;
          if (esc === `"` || esc === "\\" || esc === "n" || esc === "t") {
            buf += esc === "n" ? "\n" : esc === "t" ? "\t" : esc;
            i += 2;
            continue;
          }
        }
        buf += s[i];
        i++;
      }
      if (i >= s.length) throw new SignalError("E_INVALID", "Unterminated string literal");
      i++;
      out.push({ t: "string", v: buf });
      continue;
    }

    const two = s.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === ">=" || two === "<=") {
      out.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if (c === ">" || c === "<" || c === "," || c === ":" || c === "." || c === "(" || c === ")" || c === "=") {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }

    if (isDigit(c) || (c === "-" && isDigit(s[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < s.length && (isDigit(s[j] as string) || s[j] === ".")) j++;
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) throw new SignalError("E_INVALID", "Invalid number literal");
      out.push({ t: "number", v: num });
      i = j;
      continue;
    }

    if (isAlpha(c)) {
      let j = i + 1;
      while (j < s.length && isAlnum(s[j] as string)) j++;
      out.push({ t: "word", v: s.slice(i, j) });
      i = j;
      continue;
    }

    throw new SignalError("E_INVALID", `Unexpected character: '${c}'`);
  }

  out.push({ t: "eof" });
  return out;
}

type CondOp = "==" | "!=" | ">=" | "<=" | ">" | "<" | "HAS";
type Cond = Readonly<{ path: string; op: CondOp; value: string | number }>;

export type JoinSpec = Readonly<{
  kinds: EdgeKind[];
  dir: "out" | "in" | "both";
  depth: number;
}>;

export type QueryAST = Readonly<{
  domain: string;
  alias?: string;
  where: Cond[];
  join?: JoinSpec;
  returns: string[];
  orderBy?: { field: string; dir: "ASC" | "DESC" };
  limit: number;
}>;

function parse(tokens: Token[]): QueryAST {
  let p = 0;
  const peek = () => tokens[p] as Token;
  const next = () => tokens[p++] as Token;
  const peekWord = (): string | undefined => {
    const t = peek();
    return t.t === "word" ? t.v : undefined;
  };
  const peekOp = (): string | undefined => {
    const t = peek();
    return t.t === "op" ? t.v : undefined;
  };

  const expectWord = (w: string) => {
    const t = next();
    if (t.t !== "word" || t.v.toUpperCase() !== w.toUpperCase()) throw new SignalError("E_INVALID", `Expected ${w}`);
  };

  const expectOp = (op: string) => {
    const t = next();
    if (t.t !== "op" || t.v !== op) throw new SignalError("E_INVALID", `Expected '${op}'`);
  };

  const readWord = (): string => {
    const t = next();
    if (t.t !== "word") throw new SignalError("E_INVALID", "Expected word");
    return t.v;
  };

  const readStringOrWord = (): string => {
    const t = next();
    if (t.t === "string") return t.v;
    if (t.t === "word") return t.v;
    throw new SignalError("E_INVALID", "Expected string or word");
  };

  const readNumber = (): number => {
    const t = next();
    if (t.t !== "number") throw new SignalError("E_INVALID", "Expected number");
    return t.v;
  };

  const readPath = (): string => {
    let out = readWord();
    while (peekOp() === ".") {
      next();
      out += "." + readWord();
    }
    return out;
  };

  expectWord("FIND");
  expectWord("domain");
  expectOp(":");
  const domain = readWord();

  let alias: string | undefined;
  if (peekWord()?.toUpperCase() === "AS") {
    next();
    alias = readWord();
  }

  const where: Cond[] = [];
  let join: JoinSpec | undefined;
  let returns: string[] = [];
  let orderBy: QueryAST["orderBy"] | undefined;
  let limit = 100;

  while (peek().t !== "eof") {
    const t = peek();
    if (t.t !== "word") throw new SignalError("E_INVALID", "Expected clause keyword");

    const kw = t.v.toUpperCase();

    if (kw === "WHERE") {
      next();
      while (true) {
        const path = readPath();

        const opTok = next();
        let op: CondOp;
        if (opTok.t === "word" && opTok.v.toUpperCase() === "HAS") op = "HAS";
        else if (opTok.t === "op" && ["==", "!=", ">=", "<=", ">", "<"].includes(opTok.v)) op = opTok.v as CondOp;
        else throw new SignalError("E_INVALID", "Expected comparison operator or HAS");

        const valTok = peek();
        let value: string | number;
        if (valTok.t === "number") value = readNumber();
        else value = readStringOrWord();

        where.push({ path, op, value });

        if (peekWord()?.toUpperCase() === "AND") {
          next();
          continue;
        }
        break;
      }
      continue;
    }

    if (kw === "JOIN") {
      next();
      expectWord("via");
      expectWord("edges");
      expectOp("(");
      expectWord("kind");
      expectOp("=");

      const kinds: EdgeKind[] = [];
      while (true) {
        kinds.push(readWord() as EdgeKind);
        if (peekOp() === ",") {
          next();
          continue;
        }
        break;
      }
      expectOp(")");

      let dir: JoinSpec["dir"] = "both";
      let depth = 1;

      if (peekWord()?.toUpperCase() === "DIR") {
        next();
        expectOp("=");
        const d = readWord().toLowerCase();
        if (d !== "out" && d !== "in" && d !== "both") throw new SignalError("E_INVALID", "DIR must be out|in|both");
        dir = d;
      }

      if (peekWord()?.toUpperCase() === "DEPTH") {
        next();
        depth = readNumber();
        if (!Number.isInteger(depth) || depth < 1 || depth > 20) throw new SignalError("E_RANGE", "DEPTH must be 1..20");
      }

      join = { kinds, dir, depth };
      continue;
    }

    if (kw === "RETURN") {
      next();
      const fields: string[] = [];
      while (true) {
        fields.push(readPath());
        if (peekOp() === ",") {
          next();
          continue;
        }
        break;
      }
      returns = fields;
      continue;
    }

    if (kw === "ORDER") {
      next();
      expectWord("BY");
      const field = readPath();
      let dir: "ASC" | "DESC" = "ASC";
      const d = peekWord()?.toUpperCase();
      if (d === "ASC" || d === "DESC") {
        next();
        dir = d;
      }
      orderBy = { field, dir };
      continue;
    }

    if (kw === "LIMIT") {
      next();
      const n = readNumber();
      if (!Number.isInteger(n) || n < 1 || n > 100000) throw new SignalError("E_RANGE", "LIMIT must be 1..100000");
      limit = n;
      continue;
    }

    throw new SignalError("E_INVALID", `Unknown clause: ${t.v}`);
  }

  if (returns.length === 0) {
    returns = ["node.id", "node.domain", "node.label"];
    if (join) returns.push("r_score", "path");
  }

  return { domain, alias, where, join, returns, orderBy, limit };
}

/* ------------------------- Query Plan Compiler -------------------------- */

export type QueryResultRow = Readonly<Record<string, unknown>>;

type Accessor = (ctx: any) => unknown;

type NodePredicate = (node: GraphNode) => boolean;

function compileAccessor(path: string): Accessor {
  const parts = path.split(".");
  return (ctx: any) => {
    let cur = ctx;
    for (let i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  };
}

function compilePredicate(where: Cond[]): NodePredicate {
  const conds = where.map((c) => ({
    ...c,
    getter: compileAccessor(c.path),
  }));

  return (node: GraphNode) => {
    const base = {
      node,
      metrics: node.metrics ?? {},
      metadata: node.metadata ?? {},
      label: node.label ?? null,
      r_score: null,
      path: null,
    };

    for (const c of conds) {
      const val = c.getter(base);
      const rhs = c.value;

      if (c.op === "HAS") {
        if (Array.isArray(val)) {
          if (!val.some((x) => String(x) === String(rhs))) return false;
          continue;
        }
        if (typeof val === "string") {
          if (!val.includes(String(rhs))) return false;
          continue;
        }
        return false;
      }

      if (typeof rhs === "number") {
        const x = typeof val === "number" ? val : Number(val);
        if (!Number.isFinite(x)) return false;
        if (c.op === "==" && x !== rhs) return false;
        if (c.op === "!=" && x === rhs) return false;
        if (c.op === ">=" && x < rhs) return false;
        if (c.op === "<=" && x > rhs) return false;
        if (c.op === ">" && x <= rhs) return false;
        if (c.op === "<" && x >= rhs) return false;
        continue;
      }

      const xs = val == null ? "" : String(val);
      const rs = String(rhs);
      if (c.op === "==" && xs !== rs) return false;
      if (c.op === "!=" && xs === rs) return false;
      if (c.op === ">=" && xs < rs) return false;
      if (c.op === "<=" && xs > rs) return false;
      if (c.op === ">" && xs <= rs) return false;
      if (c.op === "<" && xs >= rs) return false;
    }

    return true;
  };
}

function compileComparator(field: string, dir: "ASC" | "DESC"): (a: QueryResultRow, b: QueryResultRow) => number {
  return (a, b) => {
    const av = a[field];
    const bv = b[field];

    if (typeof av === "number" && typeof bv === "number") return dir === "ASC" ? av - bv : bv - av;

    const as = av == null ? "" : String(av);
    const bs = bv == null ? "" : String(bv);
    if (as === bs) return 0;
    const cmp = as < bs ? -1 : 1;
    return dir === "ASC" ? cmp : -cmp;
  };
}

export type QueryPlan = Readonly<{
  ast: QueryAST;
  seedDomain: string;
  pred: NodePredicate;
  returnGetters: ReadonlyArray<{ field: string; get: Accessor }>;
  orderComparator?: (a: QueryResultRow, b: QueryResultRow) => number;
  limit: number;
  plan_id: string;
}>;

export function compileQueryPlan(queryText: string): QueryPlan {
  const ast = parse(tokenize(queryText));
  const pred = compilePredicate(ast.where);
  const returnGetters = ast.returns.map((f) => ({ field: f, get: compileAccessor(f) }));
  const orderComparator = ast.orderBy ? compileComparator(ast.orderBy.field, ast.orderBy.dir) : undefined;

  return {
    ast,
    seedDomain: ast.domain,
    pred,
    returnGetters,
    orderComparator,
    limit: ast.limit,
    plan_id: `qp_${fnv1a64Hex(stableStringify(ast))}`,
  };
}

/* ----------------------------- Plan Execution --------------------------- */

type PathState = Readonly<{ node: NodeId; pathEdges: EdgeId[]; minR: number }>;

function computePathKey(state: PathState): string {
  return fnv1a64Hex(stableStringify({ node: state.node, path: state.pathEdges }));
}

function projectRowWithPlan(
  plan: QueryPlan,
  node: GraphNode,
  r: number | null,
  path: EdgeId[] | null
): QueryResultRow {
  const base = {
    node,
    r_score: r,
    path,
    metrics: node.metrics ?? {},
    metadata: node.metadata ?? {},
    label: node.label ?? null,
  };

  const row: Record<string, unknown> = {};
  for (const { field, get } of plan.returnGetters) {
    row[field] = get(base);
  }
  return row;
}

function defaultStableSort(rows: QueryResultRow[]): QueryResultRow[] {
  return rows.slice().sort((a, b) => {
    const ai = String(a["node.id"] ?? "");
    const bi = String(b["node.id"] ?? "");
    if (ai === bi) return 0;
    return ai < bi ? -1 : 1;
  });
}

export function executePlan(index: GraphIndex, plan: QueryPlan): QueryResultRow[] {
  const seeds: GraphNode[] = [];
  for (const n of index.nodesById.values()) {
    if (n.domain === plan.seedDomain) seeds.push(n);
  }
  seeds.sort((a, b) => (a.id < b.id ? -1 : 1));

  const filtered = seeds.filter(plan.pred);

  if (!plan.ast.join) {
    let rows = filtered.map((node) => projectRowWithPlan(plan, node, null, null));
    rows = plan.orderComparator ? rows.slice().sort(plan.orderComparator) : defaultStableSort(rows);
    if (rows.length > plan.limit) rows = rows.slice(0, plan.limit);
    return rows;
  }

  const join = plan.ast.join;
  const kindsSet = new Set(join.kinds);

  const results: { node: GraphNode; path: EdgeId[]; r_score: number }[] = [];
  const visited = new Set<string>();

  for (const seed of filtered) {
    const start: PathState = { node: seed.id, pathEdges: [], minR: 1 };
    const queue: PathState[] = [start];

    for (let depth = 0; depth < join.depth; depth++) {
      const nextQueue: PathState[] = [];

      for (const st of queue) {
        const key = computePathKey(st);
        if (visited.has(key)) continue;
        visited.add(key);

        const nodeObj = index.nodesById.get(st.node);
        if (nodeObj) results.push({ node: nodeObj, path: st.pathEdges, r_score: st.minR });

        const outs: GraphEdge[] = [];
        if (join.dir === "out" || join.dir === "both") outs.push(...(index.outEdges.get(st.node) ?? []));
        if (join.dir === "in" || join.dir === "both") outs.push(...(index.inEdges.get(st.node) ?? []));

        outs.sort((a, b) => (a.id < b.id ? -1 : 1));

        for (const e of outs) {
          if (!kindsSet.has(e.kind)) continue;

          const nextNode: NodeId =
            (join.dir === "in" && e.to === st.node)
              ? e.from
              : (join.dir === "out" && e.from === st.node)
                ? e.to
                : e.from === st.node
                  ? e.to
                  : e.from;

          const minR = Math.min(st.minR, e.r_score);
          nextQueue.push({ node: nextNode, pathEdges: [...st.pathEdges, e.id], minR });
        }
      }

      queue.length = 0;
      queue.push(...nextQueue);
      if (queue.length === 0) break;
    }
  }

  results.sort((a, b) => {
    if (a.node.id !== b.node.id) return a.node.id < b.node.id ? -1 : 1;
    if (a.r_score !== b.r_score) return b.r_score - a.r_score;
    return a.path.length - b.path.length;
  });

  const best = new Map<NodeId, { r: number; path: EdgeId[]; node: GraphNode }>();
  for (const r of results) {
    const prev = best.get(r.node.id);
    if (!prev) best.set(r.node.id, { r: r.r_score, path: r.path, node: r.node });
    else {
      if (r.r_score > prev.r) best.set(r.node.id, { r: r.r_score, path: r.path, node: r.node });
      else if (r.r_score === prev.r && r.path.length < prev.path.length) {
        best.set(r.node.id, { r: r.r_score, path: r.path, node: r.node });
      }
    }
  }

  let rows = Array.from(best.values()).map((x) => projectRowWithPlan(plan, x.node, x.r, x.path));
  rows = plan.orderComparator ? rows.slice().sort(plan.orderComparator) : defaultStableSort(rows);
  if (rows.length > plan.limit) rows = rows.slice(0, plan.limit);
  return rows;
}

/* ------------------------------- Caching -------------------------------- */

type CacheEntry<V> = { key: string; value: V };

export class LruCache<V> {
  private readonly maxEntries: number;
  private readonly map = new Map<string, CacheEntry<V>>();

  constructor(maxEntries = 128) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new SignalError("E_RANGE", "maxEntries must be >= 1");
    this.maxEntries = maxEntries;
  }

  get(key: string): V | undefined {
    const ent = this.map.get(key);
    if (!ent) return undefined;
    this.map.delete(key);
    this.map.set(key, ent);
    return ent.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { key, value });

    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.map.delete(oldestKey);
    }
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}

export type QueryCaches = Readonly<{
  planCache: LruCache<QueryPlan>;
  resultCache: LruCache<QueryResultRow[]>;
}>;

export function createDefaultQueryCaches(opts?: { planMax?: number; resultMax?: number }): QueryCaches {
  return {
    planCache: new LruCache<QueryPlan>(opts?.planMax ?? 256),
    resultCache: new LruCache<QueryResultRow[]>(opts?.resultMax ?? 128),
  };
}

function resultCacheKey(graph_id: string, queryText: string): string {
  return fnv1a64Hex(stableStringify({ graph_id, queryText }));
}

export function executeQueryCached(index: GraphIndex, queryText: string, caches: QueryCaches): QueryResultRow[] {
  const rKey = resultCacheKey(index.graph_id, queryText);
  const cachedRes = caches.resultCache.get(rKey);
  if (cachedRes) return cachedRes;

  let plan = caches.planCache.get(queryText);
  if (!plan) {
    plan = compileQueryPlan(queryText);
    caches.planCache.set(queryText, plan);
  }

  const rows = executePlan(index, plan);
  caches.resultCache.set(rKey, rows);
  return rows;
}

/* ------------------------------ Convenience ----------------------------- */

export function executeQuery(index: GraphIndex, queryText: string): QueryResultRow[] {
  const plan = compileQueryPlan(queryText);
  return executePlan(index, plan);
}

/* --------------------------- Helpful: DSL docs -------------------------- */

export const DSL_HELP = `
Query DSL:

FIND domain:<domain>
  [WHERE <cond> (AND <cond>)*]
  [JOIN via edges(kind=<k1>[,<k2>...]) [DIR=out|in|both] [DEPTH <n>]]
  RETURN <field>(,<field>)*
  [ORDER BY <field> (ASC|DESC)]
  [LIMIT <n>]

Conditions:
- <path> <op> <value>
- <path> HAS <string>

Examples:
FIND domain:shape WHERE metrics.shape.symmetry_score >= 0.70 AND metrics.shape.lobe_estimate >= 8
RETURN node.id,metrics.shape.symmetry_score,metrics.shape.lobe_estimate
ORDER BY metrics.shape.symmetry_score DESC
LIMIT 50

FIND domain:text WHERE metadata.tags HAS "palindrome"
JOIN via edges(kind=convert,similarity) DIR=out DEPTH 3
RETURN node.id,node.label,r_score,path
ORDER BY r_score DESC
LIMIT 25
`.trim();
