import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Hash, Boxes, Layers, Code, Cpu, Database, Download, GitBranch, Globe2, MousePointerClick, Network, Plus, Redo2, RefreshCw, Search, Share2, SlidersHorizontal, Terminal, Undo2, X } from "lucide-react"; // or your icon library
import z from "zod";

/** --------------------------------
 * Types
 * -------------------------------- */
type MeshStateId = "solid" | "liquid" | "gas";
type DomainId = "general" | "geometry" | "networking" | "metaphor";
type FacetKey = "synonyms" | "antonyms" | "hypernyms" | "hyponyms" | "related";

type OntologyState = {
  id: MeshStateId;
  desc: string;
  keywords: string[];
  color: string; // tailwind
  bgColor: string;
  borderColor: string;
};

type Domain = {
  label: string;
  triggers: string[];
};

type OntologyRecord = {
  concept: {
    id: string;
    topic: string;
    derived_topic: string;
    etymology: string;
    definition: string;
  };
  states: Record<MeshStateId, OntologyState>;
  facets: Record<FacetKey, string[]>;
  domains: Record<Exclude<DomainId, "general">, Domain>;
};

type LogEntry = { ts: string; msg: string };

type PersistedStateV1 = {
  schema: { version: "1.0.0"; updatedAtIso: string };
  ui: {
    activeConceptId: string;
    activeState: MeshStateId;
    activeDomain: DomainId;
    query: string;
    graphMode: "concept" | "global";
    radius: number; // neighborhood hops
  };
  registry: Record<string, OntologyRecord>;
};

/** --------------------------------
 * Constants
 * -------------------------------- */
const STORAGE_KEY = "ontology.ide.persisted.v1";
const SCHEMA_VERSION: PersistedStateV1["schema"]["version"] = "1.0.0";
const HISTORY_LIMIT = 60;

/** --------------------------------
 * Helpers
 * -------------------------------- */
function nowIso(): string {
  return new Date().toISOString();
}

function timeStampNow(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function uniqClean(arr: string[]): string[] {
  const cleaned = arr
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/\s+/g, " "));
  return Array.from(new Set(cleaned));
}

function safeJsonParse<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const v = JSON.parse(raw) as T;
    return { ok: true, value: v };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Invalid JSON" };
  }
}

function downloadText(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function deepClone<T>(v: T): T {
  // Snapshot cloning for undo stack. JSON-safe data only here.
  return structuredClone(v) as T;
}

/** --------------------------------
 * Default Registry
 * -------------------------------- */
const DEFAULT_REGISTRY: Record<string, OntologyRecord> = {
  "concept.mesh": {
    concept: {
      id: "concept.mesh",
      topic: "mesh",
      derived_topic: "order",
      etymology: "Middle English 'mesche'; spacing of cords in a net.",
      definition: "A structured set of interconnections defined by relationships among elements.",
    },
    states: {
      solid: {
        id: "solid",
        desc: "Polyhedral object, static, rigid body.",
        keywords: [
          "solid",
          "polygon",
          "wireframe",
          "static",
          "rigid",
          "skeletal",
          "structure",
          "vertex",
          "edge",
          "face",
        ],
        color: "text-cyan-400",
        bgColor: "bg-cyan-900/20",
        borderColor: "border-cyan-500",
      },
      liquid: {
        id: "liquid",
        desc: "Dynamic connectivity, softbody, cloth, morph targets.",
        keywords: [
          "liquid",
          "flow",
          "softbody",
          "cloth",
          "morph",
          "deformation",
          "adaptable",
          "mutable",
          "organic",
        ],
        color: "text-purple-400",
        bgColor: "bg-purple-900/20",
        borderColor: "border-purple-500",
      },
      gas: {
        id: "gas",
        desc: "Indra's Net, graph reflection, particle system, abstract.",
        keywords: [
          "gas",
          "cloud",
          "particle",
          "graph",
          "abstract",
          "network",
          "distributed",
          "void",
          "chaos",
          "connection",
        ],
        color: "text-amber-400",
        bgColor: "bg-amber-900/20",
        borderColor: "border-amber-500",
      },
    },
    facets: {
      synonyms: ["network", "grid", "lattice", "web", "net"],
      antonyms: ["solid (mass)", "void", "disarray", "isolation"],
      hypernyms: ["structure", "arrangement", "topology"],
      hyponyms: ["polygon mesh", "wireframe", "navmesh", "service mesh"],
      related: ["vertex", "edge", "face", "topology", "connectivity", "tessellation"],
    },
    domains: {
      geometry: {
        label: "3D / Geometry",
        triggers: ["vertex", "edge", "face", "poly", "model", "lod", "collision"],
      },
      networking: {
        label: "Networking",
        triggers: ["router", "peer", "node", "link", "resilient", "distributed"],
      },
      metaphor: {
        label: "Metaphor / Social",
        triggers: ["idea", "align", "collaborate", "team", "cohesion"],
      },
    },
  },

  "concept.order": {
    concept: {
      id: "concept.order",
      topic: "order",
      derived_topic: "structure",
      etymology: "Latin 'ordo' (row, arrangement).",
      definition:
        "A predictable arrangement that reduces uncertainty by constraining possibilities.",
    },
    states: {
      solid: {
        id: "solid",
        desc: "Fixed rules, invariants, constraints, deterministic structure.",
        keywords: [
          "order",
          "rule",
          "invariant",
          "deterministic",
          "constraint",
          "schema",
          "contract",
        ],
        color: "text-cyan-400",
        bgColor: "bg-cyan-900/20",
        borderColor: "border-cyan-500",
      },
      liquid: {
        id: "liquid",
        desc: "Adaptive routines, reorganizing structure under changing context.",
        keywords: ["adapt", "reorder", "optimize", "tune", "refactor", "feedback", "flow"],
        color: "text-purple-400",
        bgColor: "bg-purple-900/20",
        borderColor: "border-purple-500",
      },
      gas: {
        id: "gas",
        desc: "Emergent order, self-organization, statistical regularities.",
        keywords: ["emergent", "entropy", "pattern", "self-organize", "swarm", "phase"],
        color: "text-amber-400",
        bgColor: "bg-amber-900/20",
        borderColor: "border-amber-500",
      },
    },
    facets: {
      synonyms: ["structure", "arrangement", "organization", "pattern", "sequence"],
      antonyms: ["chaos", "noise", "disorder", "randomness"],
      hypernyms: ["relation", "system", "constraint"],
      hyponyms: ["sorting", "taxonomy", "protocol", "workflow", "schedule"],
      related: ["entropy", "signal", "compression", "invariant", "topology", "governance"],
    },
    domains: {
      geometry: { label: "3D / Geometry", triggers: ["topology", "lattice", "symmetry", "group"] },
      networking: { label: "Networking", triggers: ["protocol", "routing", "consensus", "queue"] },
      metaphor: {
        label: "Metaphor / Social",
        triggers: ["discipline", "hierarchy", "ritual", "law"],
      },
    },
  },

  "concept.protocol": {
    concept: {
      id: "concept.protocol",
      topic: "protocol",
      derived_topic: "coordination",
      etymology: "Greek 'protokollon' (first glued sheet).",
      definition: "A shared set of rules enabling independent agents to coordinate reliably.",
    },
    states: {
      solid: {
        id: "solid",
        desc: "Strict contracts, versioning, backwards compatibility rules.",
        keywords: ["protocol", "contract", "version", "schema", "compatibility", "handshake"],
        color: "text-cyan-400",
        bgColor: "bg-cyan-900/20",
        borderColor: "border-cyan-500",
      },
      liquid: {
        id: "liquid",
        desc: "Negotiation, feature flags, optional fields, evolution paths.",
        keywords: ["negotiate", "feature-flag", "optional", "evolve", "upgrade", "capability"],
        color: "text-purple-400",
        bgColor: "bg-purple-900/20",
        borderColor: "border-purple-500",
      },
      gas: {
        id: "gas",
        desc: "Gossip, emergent coordination, best-effort discovery.",
        keywords: ["gossip", "discovery", "broadcast", "event", "mesh", "swarm"],
        color: "text-amber-400",
        bgColor: "bg-amber-900/20",
        borderColor: "border-amber-500",
      },
    },
    facets: {
      synonyms: ["standard", "spec", "convention", "handshake", "agreement"],
      antonyms: ["silence", "mismatch", "fragmentation"],
      hypernyms: ["rule", "system", "interface"],
      hyponyms: ["http", "websocket", "grpc", "mqtt", "raft"],
      related: ["codec", "envelope", "idempotency", "retries", "timeouts", "compatibility"],
    },
    domains: {
      geometry: { label: "3D / Geometry", triggers: ["interface", "adapter", "contract"] },
      networking: {
        label: "Networking",
        triggers: ["http", "ws", "grpc", "tls", "packet", "latency"],
      },
      metaphor: { label: "Metaphor / Social", triggers: ["agreement", "rules", "norms", "trust"] },
    },
  },
};

/** --------------------------------
 * LocalStorage Persistence
 * -------------------------------- */
function loadPersisted(): PersistedStateV1 | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const parsed = safeJsonParse<unknown>(raw);
  if (!parsed.ok) return null;

  // Use Zod for strict runtime validation (will be added to component body)
  // For now, basic checks to match current behavior
  const v = parsed.value as any;
  if (!v?.schema?.version || v.schema.version !== SCHEMA_VERSION) return null;
  if (!v.registry || typeof v.registry !== "object") return null;
  if (!v.ui?.activeConceptId) return null;
  if (!v.ui.graphMode) v.ui.graphMode = "concept";
  if (typeof v.ui.radius !== "number") v.ui.radius = 2;
  return v as PersistedStateV1;
}

function savePersisted(state: PersistedStateV1) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state, null, 2));
}

/** --------------------------------
 * Graph model
 * -------------------------------- */
type GraphNode = {
  id: string;
  label: string;
  group: "concept" | "facet" | "state" | "domain" | "term";
  weight: number;
  meta?: Record<string, string>;
};

type GraphEdge = {
  a: string;
  b: string;
  kind: "facet" | "state" | "domain" | "derived" | "shared";
};

type NodeSim = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

/** --------------------------------
 * Graph builders
 * -------------------------------- */
function buildConceptGraph(concept: OntologyRecord): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const rootId = concept.concept.id;
  nodes.push({ id: rootId, label: concept.concept.topic, group: "concept", weight: 12 });

  const facetOrder: Array<{ kind: FacetKey; prefix: string; weight: number }> = [
    { kind: "synonyms", prefix: "syn:", weight: 5 },
    { kind: "hyponyms", prefix: "hypo:", weight: 4 },
    { kind: "related", prefix: "rel:", weight: 3 },
    { kind: "hypernyms", prefix: "hyper:", weight: 3 },
    { kind: "antonyms", prefix: "anti:", weight: 2 },
  ];

  for (const bucket of facetOrder) {
    for (const term of concept.facets[bucket.kind]) {
      const id = `facet.${bucket.kind}.${term}`;
      nodes.push({
        id,
        label: `${bucket.prefix} ${term}`,
        group: "facet",
        weight: bucket.weight,
        meta: { term },
      });
      edges.push({ a: rootId, b: id, kind: "facet" });
    }
  }

  for (const s of Object.values(concept.states)) {
    const sid = `state.${s.id}`;
    nodes.push({
      id: sid,
      label: `state: ${s.id}`,
      group: "state",
      weight: 7,
      meta: { state: s.id },
    });
    edges.push({ a: rootId, b: sid, kind: "state" });

    for (const kw of s.keywords.slice(0, 10)) {
      const kid = `facet.keyword.${s.id}.${kw}`;
      nodes.push({ id: kid, label: kw, group: "facet", weight: 2, meta: { term: kw } });
      edges.push({ a: sid, b: kid, kind: "state" });
    }
  }

  for (const [dk, d] of Object.entries(concept.domains)) {
    const did = `domain.${dk}`;
    nodes.push({
      id: did,
      label: `domain: ${d.label}`,
      group: "domain",
      weight: 6,
      meta: { domain: dk },
    });
    edges.push({ a: rootId, b: did, kind: "domain" });

    for (const t of d.triggers.slice(0, 10)) {
      const tid = `facet.trigger.${dk}.${t}`;
      nodes.push({ id: tid, label: t, group: "facet", weight: 2, meta: { term: t } });
      edges.push({ a: did, b: tid, kind: "domain" });
    }
  }

  const map = new Map<string, GraphNode>();
  for (const n of nodes) map.set(n.id, n);

  return { nodes: Array.from(map.values()), edges };
}

function collectTermsForConcept(c: OntologyRecord): string[] {
  const terms: string[] = [];
  (Object.keys(c.facets) as FacetKey[]).forEach((k) => terms.push(...c.facets[k]));
  Object.values(c.states).forEach((s) => terms.push(...s.keywords));
  Object.values(c.domains).forEach((d) => terms.push(...d.triggers));
  terms.push(c.concept.topic);
  return uniqClean(terms.map((t) => t.toLowerCase()));
}

function findConceptIdByTopicOrId(
  registry: Record<string, OntologyRecord>,
  token: string,
): string | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;

  // direct id match
  const idCandidate = t.startsWith("concept.") ? t : `concept.${t}`;
  if (registry[idCandidate]) return idCandidate;

  // topic match
  for (const [id, rec] of Object.entries(registry)) {
    if (rec.concept.topic.trim().toLowerCase() === t) return id;
  }
  return null;
}

function buildGlobalGraph(registry: Record<string, OntologyRecord | null | undefined>): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  if (!registry) throw new Error("Registry is null or undefined");

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const conceptIds = Object.keys(registry).sort();

  // concept nodes
  for (const id of conceptIds) {
    const c = registry[id];
    if (!c) continue;

    if (!c.concept) throw new Error(`Concept ${id} has no concept field`);

    nodes.push({
      id: c.concept.id,
      label: c.concept.topic,
      group: "concept",
      weight: 12,
      meta: { conceptId: c.concept.id },
    });
  }

  // derived_topic edges between concepts (best-effort resolution)
  for (const id of conceptIds) {
    const c = registry[id];
    if (!c) continue;

    const from = c.concept.id;
    const derived = c.concept.derived_topic;
    const cleanRegistry = Object.fromEntries(
      Object.entries(registry).filter(([, v]) => v != null)
    ) as Record<string, OntologyRecord>;
    const targetId = findConceptIdByTopicOrId(cleanRegistry, derived);
    if (targetId) {
      const to = registry[targetId]?.concept.id;
      if (to && to !== from) edges.push({ a: from, b: to, kind: "derived" });
    }
  }

  // shared term hubs (top N terms appearing in >=2 concepts)
  const termToConcepts = new Map<string, Set<string>>();
  for (const id of conceptIds) {
    const c = registry[id];
    if (!c) continue;

    const conceptNodeId = c.concept.id;
    const terms = collectTermsForConcept(c);

    for (const term of terms) {
      // keep terms reasonable
      if (term.length < 2) continue;
      if (term.length > 40) continue;
      if (/^\d+$/.test(term)) continue;

      if (!termToConcepts.has(term)) termToConcepts.set(term, new Set());
      termToConcepts.get(term)!.add(conceptNodeId);
    }
  }

  const sharedTerms = Array.from(termToConcepts.entries())
    .filter(([, set]) => set.size >= 2)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 50); // cap to keep graph fast

  for (const [term, set] of sharedTerms) {
    const termId = `term.${term}`;
    nodes.push({ id: termId, label: term, group: "term", weight: 6, meta: { term } });
    for (const cid of set) edges.push({ a: cid, b: termId, kind: "shared" });
  }

  // dedupe nodes
  const map = new Map<string, GraphNode>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: Array.from(map.values()), edges };
}

function filterByNeighborhood(
  graph: { nodes: GraphNode[]; edges: GraphEdge[] },
  query: string,
  radius: number,
  seedIds: string[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const q = query.trim().toLowerCase();
  const r = clamp(radius, 0, 6);

  if (!q) return graph;

  const idToNode = new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (!adj.has(e.a)) adj.set(e.a, new Set());
    if (!adj.has(e.b)) adj.set(e.b, new Set());
    adj.get(e.a)!.add(e.b);
    adj.get(e.b)!.add(e.a);
  }

  const matched = graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id);

  const seeds = uniqClean([...seedIds, ...matched].map((x) => x));
  const visited = new Set<string>();

  type QItem = { id: string; d: number };
  const queue: QItem[] = seeds.map((id) => ({ id, d: 0 }));

  for (const s of seeds) visited.add(s);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.d >= r) continue;
    const nbrs = adj.get(cur.id);
    if (!nbrs) continue;
    for (const nb of nbrs) {
      if (visited.has(nb)) continue;
      visited.add(nb);
      queue.push({ id: nb, d: cur.d + 1 });
    }
  }

  const nodes = Array.from(visited)
    .map((id) => idToNode.get(id))
    .filter(Boolean) as GraphNode[];

  const keep = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => keep.has(e.a) && keep.has(e.b));

  return { nodes, edges };
}

/** --------------------------------
 * Graph Canvas (clickable)
 * -------------------------------- */
function GraphCanvas(props: {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  highlight: { activeState: MeshStateId; activeDomain: DomainId; query: string; rootId?: string | undefined };
  onNodeClick: (node: GraphNode) => void;
}) {
  const { graph, highlight, onNodeClick } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<{
    nodes: NodeSim[];
    edges: GraphEdge[];
    idToIndex: Map<string, number>;
    hoveredId: string | null;
    lastSize: { w: number; h: number };
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const initSim = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const nodes: NodeSim[] = graph.nodes.map((n) => ({
        ...n,
        x: w * 0.5 + (Math.random() - 0.5) * Math.min(w, h) * 0.45,
        y: h * 0.5 + (Math.random() - 0.5) * Math.min(w, h) * 0.45,
        vx: 0,
        vy: 0,
      }));

      // optional pin root
      if (highlight.rootId) {
        const rootIdx = nodes.findIndex((n) => n.id === highlight.rootId);
        if (rootIdx >= 0) {
          const node = nodes[rootIdx];
          if (node) {
            node.x = w * 0.5;
            node.y = h * 0.5;
          }
        }
      }

      const idToIndex = new Map<string, number>();
      nodes.forEach((n, i) => idToIndex.set(n.id, i));

      simRef.current = {
        nodes,
        edges: graph.edges,
        idToIndex,
        hoveredId: null,
        lastSize: { w, h },
      };
    };

    const resize = () => {
      const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sim = simRef.current;
      if (sim) {
        const dx = (w - sim.lastSize.w) * 0.5;
        const dy = (h - sim.lastSize.h) * 0.5;
        sim.nodes.forEach((n) => {
          n.x += dx;
          n.y += dy;
        });
        sim.lastSize = { w, h };
      } else {
        initSim();
      }
    };

    const radiusFor = (n: NodeSim): number => {
      if (n.group === "concept") return 12;
      if (n.group === "state") return 9;
      if (n.group === "domain") return 8;
      if (n.group === "term") return 9;
      return 6;
    };

    const colorForNode = (n: NodeSim): string => {
      const q = highlight.query.trim().toLowerCase();
      const labelHit = q && n.label.toLowerCase().includes(q);

      if (n.group === "concept") return labelHit ? "#e2e8f0" : "#22d3ee";
      if (n.group === "term") return labelHit ? "#ffffff" : "#fbbf24";

      if (n.group === "state") {
        const st = n.meta?.state;
        if (st === highlight.activeState) return "#ffffff";
        return highlight.activeState === "solid"
          ? "#22d3ee"
          : highlight.activeState === "liquid"
            ? "#a855f7"
            : "#fbbf24";
      }

      if (n.group === "domain") {
        const dk = n.meta?.domain;
        if (highlight.activeDomain !== "general" && dk === highlight.activeDomain) return "#ffffff";
        return "#94a3b8";
      }

      // facet nodes
      return labelHit ? "#e2e8f0" : "#64748b";
    };

    const step = () => {
      if (!simRef.current) initSim();
      const sim = simRef.current!;
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      const centerX = w * 0.5;
      const centerY = h * 0.5;

      // gravity + damping + bounds
      for (const n of sim.nodes) {
        const pin = highlight.rootId && n.id === highlight.rootId;
        if (pin) {
          n.x = centerX;
          n.y = centerY;
          n.vx = 0;
          n.vy = 0;
          continue;
        }

        const gx = (centerX - n.x) * 0.00045;
        const gy = (centerY - n.y) * 0.00045;
        n.vx += gx;
        n.vy += gy;

        n.vx *= 0.92;
        n.vy *= 0.92;

        n.x += n.vx;
        n.y += n.vy;

        const pad = 18;
        if (n.x < pad) n.x = pad;
        if (n.x > w - pad) n.x = w - pad;
        if (n.y < pad) n.y = pad;
        if (n.y > h - pad) n.y = h - pad;
      }

      // springs
      for (const e of sim.edges) {
        const ai = sim.idToIndex.get(e.a);
        const bi = sim.idToIndex.get(e.b);
        if (ai == null || bi == null) continue;

        const a = sim.nodes[ai];
        const b = sim.nodes[bi];
        if (!a || !b) continue;

        const dx = (b?.x ?? 0) - (a?.x ?? 0);
        const dy = (b?.y ?? 0) - (a?.y ?? 0);
        const dist = Math.max(1, Math.hypot(dx, dy));
        const target =
          e.kind === "derived"
            ? 130
            : e.kind === "shared"
              ? 120
              : e.kind === "domain"
                ? 95
                : e.kind === "facet"
                  ? 85
                  : 90;

        const k = 0.00075;
        const diff = dist - target;
        const nx = dx / dist;
        const ny = dy / dist;

        const pinA = highlight.rootId && a.id === highlight.rootId;
        const pinB = highlight.rootId && b.id === highlight.rootId;

        if (!pinA) {
          a.vx += nx * diff * k;
          a.vy += ny * diff * k;
        }
        if (!pinB) {
          b.vx -= nx * diff * k;
          b.vy -= ny * diff * k;
        }
      }

      // repulsion (keep it modest)
      const repK = 1100;
      for (let i = 0; i < sim.nodes.length; i++) {
        for (let j = i + 1; j < sim.nodes.length; j++) {
          const a = sim.nodes[i];
          const b = sim.nodes[j];
          if (!a || !b) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1) continue;

          if (d2 < 260 * 260) {
            const d = Math.sqrt(d2);
            const force = repK / d2;
            const nx = dx / d;
            const ny = dy / d;
            const push = force * 0.02;

            const pinA = highlight.rootId && a.id === highlight.rootId;
            const pinB = highlight.rootId && b.id === highlight.rootId;

            if (!pinA) {
              a.vx -= nx * push;
              a.vy -= ny * push;
            }
            if (!pinB) {
              b.vx += nx * push;
              b.vy += ny * push;
            }
          }
        }
      }

      // draw
      ctx.clearRect(0, 0, w, h);

      // edges
      for (const e of sim.edges) {
        const ai = sim.idToIndex.get(e.a);
        const bi = sim.idToIndex.get(e.b);
        if (ai == null || bi == null) continue;
        const a = sim.nodes[ai];
        const b = sim.nodes[bi];
        if (!a || !b) continue;

        ctx.lineWidth = 1;
        ctx.strokeStyle =
          e.kind === "derived"
            ? "rgba(34,211,238,0.25)"
            : e.kind === "shared"
              ? "rgba(251,191,36,0.18)"
              : e.kind === "facet"
                ? "rgba(148,163,184,0.16)"
                : e.kind === "domain"
                  ? "rgba(34,211,238,0.16)"
                  : "rgba(168,85,247,0.16)";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // nodes + labels
      for (const n of sim.nodes) {
        const r = radiusFor(n);
        const isHover = sim.hoveredId === n.id;
        const fill = colorForNode(n);

        ctx.beginPath();
        ctx.arc(n.x, n.y, r + (isHover ? 6 : 4), 0, Math.PI * 2);
        ctx.fillStyle =
          n.group === "concept"
            ? "rgba(34,211,238,0.10)"
            : n.group === "term"
              ? "rgba(251,191,36,0.10)"
              : n.group === "state"
                ? "rgba(168,85,247,0.08)"
                : "rgba(148,163,184,0.06)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.font = isHover ? "12px ui-monospace" : "11px ui-monospace";
        ctx.fillStyle = isHover ? "rgba(226,232,240,0.95)" : "rgba(226,232,240,0.72)";
        ctx.textBaseline = "middle";

        const label = n.label.length > 28 ? n.label.slice(0, 28) + "…" : n.label;
        ctx.fillText(label, n.x + r + 8, n.y);
      }

      raf = globalThis.requestAnimationFrame(step);
    };

    const onMove = (ev: MouseEvent) => {
      const sim = simRef.current;
      if (!sim) return;

      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;

      let hit: string | null = null;
      let bestD2 = Infinity;

      for (const n of sim.nodes) {
        const r = radiusFor(n) + 7;
        const dx = mx - n.x;
        const dy = my - n.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r * r && d2 < bestD2) {
          bestD2 = d2;
          hit = n.id;
        }
      }

      sim.hoveredId = hit;
      canvas.style.cursor = hit ? "pointer" : "default";
    };

    const onClick = () => {
      const sim = simRef.current;
      if (!sim?.hoveredId) return;
      const idx = sim.idToIndex.get(sim.hoveredId);
      if (idx == null) return;
      const node = sim.nodes[idx];
      if (!node) return;
      onNodeClick(node);
    };

    // init
    initSim();
    globalThis.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);
    resize();
    step();

    return () => {
      globalThis.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
      globalThis.cancelAnimationFrame(raf);
    };
  }, [
    graph.nodes,
    graph.edges,
    highlight.activeState,
    highlight.activeDomain,
    highlight.query,
    highlight.rootId,
    onNodeClick,
  ]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[10px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded px-2 py-1">
        <MousePointerClick size={12} className="text-slate-500" />
        Click nodes: concept→switch, term/facet→query, state/domain→route
      </div>
    </div>
  );
}

/** --------------------------------
 * MAIN: Ontology IDE
 * -------------------------------- */
export default function OntologyIDE() {
  const persisted = useMemo(() => {
    if (typeof globalThis.window === "undefined") return null;
    try {
      return loadPersisted();
    } catch {
      return null;
    }
  }, []);

  const [registry, setRegistry] = useState<Record<string, OntologyRecord>>(
    persisted?.registry ?? DEFAULT_REGISTRY,
  );
  const [activeConceptId, setActiveConceptId] = useState<string>(
    persisted?.ui.activeConceptId ?? "concept.mesh",
  );
  const [activeState, setActiveState] = useState<MeshStateId>(persisted?.ui.activeState ?? "solid");
  const [activeDomain, setActiveDomain] = useState<DomainId>(
    persisted?.ui.activeDomain ?? "general",
  );
  const [query, setQuery] = useState<string>(persisted?.ui.query ?? "");
  const [queryDraft, setQueryDraft] = useState<string>(persisted?.ui.query ?? "");
  const queryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [graphMode, setGraphMode] = useState<"concept" | "global">(
    persisted?.ui.graphMode ?? "concept",
  );
  const [radius, setRadius] = useState<number>(
    typeof persisted?.ui.radius === "number" ? persisted.ui.radius : 2,
  );

  const [searchLog, setSearchLog] = useState<LogEntry[]>([]);
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);
  const [importText, setImportText] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);

  // Undo stack: snapshots of (registry + ui)
  const [history, setHistory] = useState<PersistedStateV1[]>(() => {
    const init: PersistedStateV1 = {
      schema: { version: SCHEMA_VERSION, updatedAtIso: nowIso() },
      ui: { activeConceptId, activeState, activeDomain, query, graphMode, radius },
      registry: deepClone(registry),
    };
    return [init];
  });
  const [histIndex, setHistIndex] = useState<number>(0);
  const isApplyingHistory = useRef(false);

  const activeConcept = registry[activeConceptId] ?? registry["concept.mesh"];

  // Concept options
  const conceptOptions = useMemo(() => {
    const ids = Object.keys(registry).sort();
    return ids
      .filter((id) => registry[id])
      .map((id) => ({ id, label: `${registry[id]!.concept.topic} (${id})` }));
  }, [registry]);

  // Persist to localStorage
  useEffect(() => {
    const state: PersistedStateV1 = {
      schema: { version: SCHEMA_VERSION, updatedAtIso: nowIso() },
      ui: { activeConceptId, activeState, activeDomain, query, graphMode, radius },
      registry,
    };
    try {
      savePersisted(state);
    } catch {
      // ignore
    }
  }, [registry, activeConceptId, activeState, activeDomain, query, graphMode, radius]);

  /** Commit to undo history (call for user actions you want undoable) */
  function commit(
    reason: string,
    next: { registry?: Record<string, OntologyRecord>; ui?: Partial<PersistedStateV1["ui"]> },
  ) {
    if (isApplyingHistory.current) return;

    const nextRegistry = next.registry ?? registry;
    const nextUi: PersistedStateV1["ui"] = {
      activeConceptId,
      activeState,
      activeDomain,
      query,
      graphMode,
      radius,
      ...(next.ui ?? {}),
    };

    const snap: PersistedStateV1 = {
      schema: { version: SCHEMA_VERSION, updatedAtIso: nowIso() },
      ui: deepClone(nextUi),
      registry: deepClone(nextRegistry),
    };

    setHistory((prev) => {
      const base = prev.slice(0, histIndex + 1);
      base.push(snap);

      // trim from the front if needed
      if (base.length > HISTORY_LIMIT) {
        const cut = base.length - HISTORY_LIMIT;
        base.splice(0, cut);
        // adjust histIndex by same cut (we're effectively shifting window)
        setHistIndex(base.length - 1);
      } else {
        setHistIndex(base.length - 1);
      }

      return base;
    });

    setSearchLog((prev) =>
      [{ ts: timeStampNow(), msg: `Commit: ${reason}` }, ...prev].slice(0, 80),
    );
  }

  function applySnapshot(snap: PersistedStateV1, msg: string) {
    isApplyingHistory.current = true;
    try {
      setRegistry(deepClone(snap.registry));
      setActiveConceptId(snap.ui.activeConceptId);
      setActiveState(snap.ui.activeState);
      setActiveDomain(snap.ui.activeDomain);
      setQuery(snap.ui.query);
      setGraphMode(snap.ui.graphMode);
      setRadius(snap.ui.radius);
      setSearchLog((prev) => [{ ts: timeStampNow(), msg }, ...prev].slice(0, 80));
    } finally {
      // allow state updates to settle before re-enabling commits
      setTimeout(() => {
        isApplyingHistory.current = false;
      }, 0);
    }
  }

  function undo() {
    if (histIndex <= 0) return;
    const nextIdx = histIndex - 1;
    setHistIndex(nextIdx);
    const snap = history[nextIdx];
    if (snap) applySnapshot(snap, "Undo");
  }

  function redo() {
    if (histIndex >= history.length - 1) return;
    const nextIdx = histIndex + 1;
    setHistIndex(nextIdx);
    const snap = history[nextIdx];
    if (snap) applySnapshot(snap, "Redo");
  }

  // Debounced query commits
  useEffect(() => {
    if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current);
    queryDebounceRef.current = globalThis.setTimeout(() => {
      if (queryDraft === query) return;
      commit("Edit query", { ui: { query: queryDraft } });
      setQuery(queryDraft);
    }, 250);
    return () => {
      if (queryDebounceRef.current) clearTimeout(queryDebounceRef.current);
    };

  }, [queryDraft]);

  // Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (!mod) return;

      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);

  }, [histIndex, history]);

  // Search / routing logic (concept-aware, non-destructive)
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setExpandedTerms([]);
      setSearchLog((prev) => prev); // keep log
      setActiveDomain("general");
      return;
    }

    if (!activeConcept) return;

    const lower = q.toLowerCase();
    const log: LogEntry[] = [];
    const add = (msg: string) => log.push({ ts: timeStampNow(), msg });

    add(`Concept: "${activeConcept.concept.topic}" (${activeConcept.concept.id})`);
    add(`Analyzed Input: "${q}"`);

    // expansion: if query hits topic or a synonym
    let expanded = [lower];
    const hit =
      lower.includes(activeConcept.concept.topic.toLowerCase()) ||
      activeConcept.facets.synonyms.some((s) => lower.includes(s.toLowerCase()));

    if (hit) {
      expanded = expanded.concat(activeConcept.facets.synonyms.map((s) => s.toLowerCase()));
      add(`Hit concept root → Expanded ${activeConcept.facets.synonyms.length} synonyms`);
    }

    // state detection score (does NOT auto-switch; you can choose to auto-switch by committing; here we only compute)
    let bestState: MeshStateId | null = null;
    let bestScore = 0;
    for (const s of Object.values(activeConcept.states)) {
      let score = 0;
      for (const kw of s.keywords) if (lower.includes(kw.toLowerCase())) score += 1;
      if (score > bestScore) {
        bestScore = score;
        bestState = s.id;
      }
    }
    if (bestState && bestScore > 0)
      add(`State candidate: [${bestState.toUpperCase()}] (Score: ${bestScore})`);

    // domain routing
    let bestDomain: DomainId = "general";
    let bestDomainScore = 0;
    for (const [dk, d] of Object.entries(activeConcept.domains) as Array<
      [Exclude<DomainId, "general">, Domain]
    >) {
      let score = 0;
      for (const t of d.triggers) if (lower.includes(t.toLowerCase())) score += 10;
      if (score > bestDomainScore) {
        bestDomainScore = score;
        bestDomain = dk;
      }
    }

    if (bestDomainScore > 0) {
      const bestDomainLabel =
        bestDomain === "general" ? "General" : activeConcept.domains[bestDomain].label;
      add(
        `Domain candidate: [${bestDomainLabel}] (Score: ${bestDomainScore})`,
      );
      setActiveDomain(bestDomain);
    } else {
      setActiveDomain("general");
    }

    setExpandedTerms(uniqClean(expanded));
    setSearchLog((prev) => [...log, ...prev].slice(0, 80));
  }, [query, activeConceptId, activeConcept]);

  // Graph: build based on mode
  const rawGraph = useMemo(() => {
    if (!activeConcept) return { nodes: [], edges: [] };
    return graphMode === "concept" ? buildConceptGraph(activeConcept) : buildGlobalGraph(registry);
  }, [graphMode, activeConcept, registry]);

  const filteredGraph = useMemo(() => {
    if (!activeConcept) return { nodes: [], edges: [] };
    const rootId = graphMode === "concept" ? activeConcept.concept.id : undefined;
    const seeds = rootId ? [rootId] : [];
    return filterByNeighborhood(rawGraph, query, radius, seeds);
  }, [rawGraph, query, radius, graphMode, activeConcept]);

  /** --------------------------------
   * Export / Import / Reset
   * -------------------------------- */
  function exportAll() {
    const payload: PersistedStateV1 = {
      schema: { version: SCHEMA_VERSION, updatedAtIso: nowIso() },
      ui: { activeConceptId, activeState, activeDomain, query, graphMode, radius },
      registry,
    };
    downloadText(
      `ontology_ide_export_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      JSON.stringify(payload, null, 2),
    );
    setSearchLog((prev) =>
      [{ ts: timeStampNow(), msg: "Exported registry + UI state." }, ...prev].slice(0, 80),
    );
  }

  function importAllFromText() {
    setImportError(null);

    const parsed = safeJsonParse<unknown>(importText);
    if (!parsed.ok) {
      setImportError(parsed.error);
      return;
    }

    const checked = PersistedStateV1Schema.safeParse(parsed.value);
    if (!checked.success) {
      setImportError(
        checked.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"),
      );
      return;
    }

    const v = checked.data; // fully typed + valid

    // Commit import as a single undoable action
    commit("Import JSON", { registry: v.registry, ui: v.ui });

    setRegistry(v.registry);
    setActiveConceptId(v.ui.activeConceptId);
    setActiveState(v.ui.activeState);
    setActiveDomain(v.ui.activeDomain);
    setQuery(v.ui.query);
    setGraphMode(v.ui.graphMode ?? "concept");
    setRadius(typeof v.ui.radius === "number" ? v.ui.radius : 2);

    setSearchLog((prev) =>
      [{ ts: timeStampNow(), msg: "Imported registry + UI state." }, ...prev].slice(0, 80),
    );
  }

  function resetDefaults() {
    const nextReg = deepClone(DEFAULT_REGISTRY);
    commit("Reset to defaults", {
      registry: nextReg,
      ui: {
        activeConceptId: "concept.mesh",
        query: "",
        activeDomain: "general",
        activeState: "solid",
        graphMode: "concept",
        radius: 2,
      },
    });
    setRegistry(nextReg);
    setActiveConceptId("concept.mesh");
    setActiveState("solid");
    setActiveDomain("general");
    setQueryDraft("");
    setQuery("");
    setGraphMode("concept");
    setRadius(2);
  }

  // === Zod Validation Schemas ===
  const PersistedStateV1SchemaRuntime = useMemo(() => {
    const MeshStateIdSchema = z.union([z.literal("solid"), z.literal("liquid"), z.literal("gas")]);
    const DomainIdSchema = z.union([
      z.literal("general"),
      z.literal("geometry"),
      z.literal("networking"),
      z.literal("metaphor"),
    ]);
    const FacetKeySchema = z.union([
      z.literal("synonyms"),
      z.literal("antonyms"),
      z.literal("hypernyms"),
      z.literal("hyponyms"),
      z.literal("related"),
    ]);

    const OntologyStateSchema = z.object({
      id: MeshStateIdSchema,
      desc: z.string(),
      keywords: z.array(z.string()),
      color: z.string(),
      bgColor: z.string(),
      borderColor: z.string(),
    });

    const DomainSchema = z.object({
      label: z.string(),
      triggers: z.array(z.string()),
    });

    const OntologyRecordSchema = z.object({
      concept: z.object({
        id: z.string(),
        topic: z.string(),
        derived_topic: z.string(),
        etymology: z.string(),
        definition: z.string(),
      }),
      states: z.object({
        solid: OntologyStateSchema,
        liquid: OntologyStateSchema,
        gas: OntologyStateSchema,
      }),
      facets: z.record(z.string(), z.array(z.string())),
      domains: z.object({
        geometry: DomainSchema,
        networking: DomainSchema,
        metaphor: DomainSchema,
      }),
    });

    return z.object({
      schema: z.object({
        version: z.literal("1.0.0"),
        updatedAtIso: z.string(),
      }),
      ui: z.object({
        activeConceptId: z.string(),
        activeState: MeshStateIdSchema,
        activeDomain: DomainIdSchema,
        query: z.string(),
        graphMode: z.union([z.literal("concept"), z.literal("global")]),
        radius: z.number(),
      }),
      registry: z.record(z.string(), OntologyRecordSchema),
    });
  }, []);

  const MeshStateIdSchema = z.union([z.literal("solid"), z.literal("liquid"), z.literal("gas")]);
  const DomainIdSchema = z.union([
    z.literal("general"),
    z.literal("geometry"),
    z.literal("networking"),
    z.literal("metaphor"),
  ]);
  const FacetKeySchema = z.union([
    z.literal("synonyms"),
    z.literal("antonyms"),
    z.literal("hypernyms"),
    z.literal("hyponyms"),
    z.literal("related"),
  ]);

  const OntologyStateSchema = z.object({
    id: MeshStateIdSchema,
    desc: z.string(),
    keywords: z.array(z.string()),
    color: z.string(),
    bgColor: z.string(),
    borderColor: z.string(),
  });

  const DomainSchema = z.object({
    label: z.string(),
    triggers: z.array(z.string()),
  });

  const OntologyRecordSchema = z.object({
    concept: z.object({
      id: z.string(),
      topic: z.string(),
      derived_topic: z.string(),
      etymology: z.string(),
      definition: z.string(),
    }),
    states: z.object({
      solid: OntologyStateSchema,
      liquid: OntologyStateSchema,
      gas: OntologyStateSchema,
    }),
    facets: z.record(z.string(), z.array(z.string())),
    domains: z.object({
      geometry: DomainSchema,
      networking: DomainSchema,
      metaphor: DomainSchema,
    }),
  });

  const PersistedStateV1Schema = z.object({
    schema: z.object({
      version: z.literal("1.0.0"),
      updatedAtIso: z.string(),
    }),
    ui: z.object({
      activeConceptId: z.string(),
      activeState: MeshStateIdSchema,
      activeDomain: DomainIdSchema,
      query: z.string(),
      graphMode: z.union([z.literal("concept"), z.literal("global")]),
      radius: z.number(),
    }),
    registry: z.record(z.string(), OntologyRecordSchema),
  });

  /** Graph click routing */
  function onGraphNodeClick(node: GraphNode) {
    // Global mode: click concept switches to that concept
    if (node.group === "concept") {
      const targetKey =
        Object.keys(registry).find((k) => registry[k]?.concept.id === node.id) ?? null;
      if (targetKey && registry[targetKey]) {
        commit("Graph: switch concept", {
          ui: { activeConceptId: targetKey, graphMode: "concept" },
        });
        setActiveConceptId(targetKey);
        setGraphMode("concept");
        const t = registry[targetKey].concept.topic;
        setQueryDraft(t);
        setQuery(t);
      } else {
        setQueryDraft(node.label);
        setQuery(node.label);
      }
      return;
    }

    if (node.group === "term" || node.group === "facet") {
      const t = node.meta?.term ?? node.label;
      commit("Graph: set query", { ui: { query: t } });
      setQueryDraft(t);
      setQuery(t);
      return;
    }

    if (node.group === "state") {
      const st = (node.meta?.state as MeshStateId) ?? null;
      if (st && (st === "solid" || st === "liquid" || st === "gas")) {
        commit("Graph: set state", { ui: { activeState: st } });
        setActiveState(st);
      }
      return;
    }

    if (node.group === "domain") {
      const dk = (node.meta?.domain as DomainId) ?? null;
      if (dk === "geometry" || dk === "networking" || dk === "metaphor") {
        commit("Graph: set domain", { ui: { activeDomain: dk } });
        setActiveDomain(dk);
      }
      return;
    }
  }

  /**
   * Update the active concept in the registry.
   *
   * @param {function} mutator - A function that takes the current concept and returns the updated concept.
   * @param {string} reason - A string describing the reason for the update.
   */
  function updateActiveConcept(mutator: (c: OntologyRecord) => OntologyRecord, reason: string) {
    const nextRegistry = deepClone(registry);
    const key = activeConceptId;
    if (!nextRegistry[key]) return;

    nextRegistry[key] = mutator(nextRegistry[key]);
    commit(`Update concept: ${key} - ${reason}`, { registry: nextRegistry });
    setRegistry(nextRegistry);
  }

  function addFacetItem(facet: FacetKey, value: string) {
    const v = value.trim();
    if (!v) return;
    updateActiveConcept((c) => {
      const next = deepClone(c);
      next.facets[facet] = uniqClean([...next.facets[facet], v]);
      return next;
    }, `Add facet: ${facet} += "${v}"`);
  }

  function removeFacetItem(facet: FacetKey, value: string) {
    updateActiveConcept((c) => {
      const next = deepClone(c);
      next.facets[facet] = next.facets[facet].filter((x) => x !== value);
      return next;
    }, `Remove facet: ${facet} -= "${value}"`);
  }

  function addKeyword(state: MeshStateId, value: string) {
    const v = value.trim();
    if (!v) return;
    updateActiveConcept((c) => {
      const next = deepClone(c);
      next.states[state].keywords = uniqClean([...next.states[state].keywords, v]);
      return next;
    }, `Add keyword: ${state} += "${v}"`);
  }

  function removeKeyword(state: MeshStateId, value: string) {
    updateActiveConcept((c) => {
      const next = deepClone(c);
      next.states[state].keywords = next.states[state].keywords.filter((x) => x !== value);
      return next;
    }, `Remove keyword: ${state} -= "${value}"`);
  }

  function addTrigger(domain: Exclude<DomainId, "general">, value: string) {
    const v = value.trim();
    if (!v) return;
    updateActiveConcept((c) => {
      const next = deepClone(c);
      next.domains[domain].triggers = uniqClean([...next.domains[domain].triggers, v]);
      return next;
    }, `Add trigger: ${domain} += "${v}"`);
  }

  function removeTrigger(domain: Exclude<DomainId, "general">, value: string) {
    updateActiveConcept((c) => {
      const next = deepClone(c);
      next.domains[domain].triggers = next.domains[domain].triggers.filter((x) => x !== value);
      return next;
    }, `Remove trigger: ${domain} -= "${value}"`);
  }

  function updateConceptField(field: keyof OntologyRecord["concept"], value: string) {
    updateActiveConcept((c) => {
      const next = deepClone(c);
      (next.concept[field] as string) = value;
      return next;
    }, `Edit concept.${field}`);
  }

  function createConcept(newTopic: string) {
    const topic = newTopic.trim();
    if (!topic) return;

    const id = `concept.${topic
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")}`;
    const nextReg = deepClone(registry);
    if (nextReg[id]) return;

    if (!activeConcept) return;
    const template = deepClone(activeConcept);
    template.concept = {
      id,
      topic,
      derived_topic: activeConcept.concept.topic,
      etymology: "",
      definition: "",
    };

    nextReg[id] = template;
    commit(`Create concept: ${id}`, { registry: nextReg, ui: { activeConceptId: id } });
    setRegistry(nextReg);
    setActiveConceptId(id);
    setGraphMode("concept");
    setQuery(topic);
  }

  function deleteConcept(id: string) {
    if (Object.keys(registry).length <= 1) return;
    if (!registry[id]) return;

    const nextReg = deepClone(registry);
    delete nextReg[id];

    const fallback = Object.keys(nextReg).sort()[0] ?? "concept.mesh";
    commit(`Delete concept: ${id}`, { registry: nextReg, ui: { activeConceptId: fallback } });

    setRegistry(nextReg);
    setActiveConceptId(fallback);
    setGraphMode("concept");
    setQuery(nextReg[fallback]!.concept.topic);
  }

  /** --------------------------------
   * UI state changes as undoable (optional but nice)
   * -------------------------------- */
  function setModeUndoable(mode: "concept" | "global") {
    commit(`Graph mode: ${mode}`, { ui: { graphMode: mode } });
    setGraphMode(mode);
  }

  function setRadiusUndoable(r: number) {
    const rr = clamp(Math.round(r), 0, 6);
    commit(`Neighborhood radius: ${rr}`, { ui: { radius: rr } });
    setRadius(rr);
  }

  function setConceptUndoable(id: string) {
    commit("Switch active concept", { ui: { activeConceptId: id } });
    setActiveConceptId(id);
    const t = registry[id]?.concept.topic ?? "";
    setQueryDraft(t);
    setQuery(t);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-mono overflow-hidden selection:bg-cyan-500/30">
      {/* HEADER */}
      <header className="flex-none h-16 border-b border-slate-800 flex items-center px-6 justify-between bg-slate-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <Network className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            ONTOLOGY_IDE<span className="text-slate-600">.idx</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Database size={14} /> Active: {activeConcept?.concept.id}
          </span>
          <span className="flex items-center gap-1">
            <Share2 size={14} /> Schema: {SCHEMA_VERSION}
          </span>

          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={undo}
              disabled={histIndex <= 0}
              className={`px-2 py-1 border rounded text-[10px] uppercase font-bold flex items-center gap-1 ${
                histIndex <= 0
                  ? "border-slate-800 text-slate-700"
                  : "border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300"
              }`}
              title="Undo (Ctrl/Cmd+Z)"
            >
              <Undo2 size={14} /> Undo
            </button>

            <button
              onClick={redo}
              disabled={histIndex >= history.length - 1}
              className={`px-2 py-1 border rounded text-[10px] uppercase font-bold flex items-center gap-1 ${
                histIndex >= history.length - 1
                  ? "border-slate-800 text-slate-700"
                  : "border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300"
              }`}
              title="Redo (Ctrl/Cmd+Y)"
            >
              <Redo2 size={14} /> Redo
            </button>
          </div>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* LEFT: GRAPH */}
        <div className="col-span-12 lg:col-span-7 flex flex-col border-r border-slate-800 bg-slate-950">
          {/* Top controls */}
          <div className="flex-none p-4 border-b border-slate-800 bg-slate-950/60 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3">
              {/* Concept selector */}
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-slate-500" />
                <label className="text-[10px] uppercase font-bold text-slate-500">Concept</label>
                <select
                  value={activeConceptId}
                  onChange={(e) => setConceptUndoable(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  title="Select active concept"
                >
                  {conceptOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => createConcept(prompt("New concept topic? (e.g., entropy)") ?? "")}
                  className="px-2 py-1 border border-slate-700 rounded bg-slate-900 hover:border-slate-500 text-slate-300 text-[10px] uppercase font-bold flex items-center gap-1"
                  title="Create a new concept (clones active as template)"
                >
                  <Plus size={14} /> New
                </button>

                <button
                  onClick={() => deleteConcept(activeConceptId)}
                  disabled={Object.keys(registry).length <= 1}
                  className={`px-2 py-1 border rounded text-[10px] uppercase font-bold flex items-center gap-1 ${
                    Object.keys(registry).length <= 1
                      ? "border-slate-800 text-slate-700"
                      : "border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300"
                  }`}
                  title="Delete active concept (keeps at least 1)"
                >
                  <X size={14} /> Delete
                </button>
              </div>

              {/* Graph Mode */}
              <div className="flex items-center gap-2 ml-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2">
                  <Globe2 size={14} className="text-slate-500" /> Graph
                </label>

                <button
                  onClick={() => setModeUndoable("concept")}
                  className={`px-3 py-1.5 text-[10px] uppercase font-bold border transition-all flex items-center gap-2 ${
                    graphMode === "concept"
                      ? "border-cyan-500/60 bg-cyan-950/20 text-cyan-200"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <Boxes size={14} /> Concept
                </button>

                <button
                  onClick={() => setModeUndoable("global")}
                  className={`px-3 py-1.5 text-[10px] uppercase font-bold border transition-all flex items-center gap-2 ${
                    graphMode === "global"
                      ? "border-amber-500/60 bg-amber-950/20 text-amber-200"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <Layers size={14} /> Global
                </button>
              </div>

              {/* Radius */}
              <div className="flex items-center gap-3 ml-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-slate-500" /> Radius
                </label>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={1}
                  value={radius}
                  onChange={(e) => setRadiusUndoable(Number(e.target.value))}
                  className="w-40 accent-cyan-400"
                  title="Neighborhood hops from matches + root"
                />
                <span className="text-xs text-slate-400 w-6 text-right">{radius}</span>
              </div>

              {/* Export / Reset */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={exportAll}
                  className="px-3 py-1.5 text-[10px] uppercase font-bold border border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300 flex items-center gap-2"
                  title="Export registry + UI state"
                >
                  <Download size={14} /> Export
                </button>
                <button
                  onClick={resetDefaults}
                  className="px-3 py-1.5 text-[10px] uppercase font-bold border border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300 flex items-center gap-2"
                  title="Reset everything"
                >
                  <RefreshCw size={14} /> Reset
                </button>
              </div>
            </div>

            {activeConcept && (
              <div className="mt-3 text-xs text-slate-400 leading-relaxed">
                <span className="text-slate-500">Etymology:</span>{" "}
                {activeConcept.concept.etymology || <span className="text-slate-600">—</span>}
                <span className="text-slate-600"> {" · "} </span>
                <span className="text-slate-500">Definition:</span>{" "}
                {activeConcept.concept.definition || <span className="text-slate-600">—</span>}
              </div>
            )}
          </div>

          {/* Graph area */}
          <div className="flex-1 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(50, 60, 80, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(50, 60, 80, 0.5) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            {activeConcept && (
              <GraphCanvas
                graph={filteredGraph}
                highlight={{
                  activeState,
                  activeDomain,
                  query,
                  rootId: graphMode === "concept" ? activeConcept.concept.id : undefined,
                }}
                onNodeClick={onGraphNodeClick}
              />
            )}
          </div>

          {/* Footer hint */}
          <div className="flex-none px-4 py-2 border-t border-slate-800 bg-slate-950/70 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MousePointerClick size={12} className="text-slate-500" />
              Neighborhood filter: matches + root, radius {radius}
            </span>
            <span className="flex items-center gap-2">
              <Hash size={12} className="text-slate-500" />
              Nodes: {filteredGraph.nodes.length} · Edges: {filteredGraph.edges.length}
            </span>
          </div>
        </div>

        {/* RIGHT: IDE PANEL */}
        <div className="col-span-12 lg:col-span-5 flex flex-col bg-slate-900">
          {/* Search Bar */}
          <div className="p-6 border-b border-slate-800">
            <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">
              Search Query
            </label>
            <div className="relative group">
              <Search
                className="absolute left-3 top-3 text-slate-500 group-focus-within:text-cyan-400 transition-colors"
                size={18}
              />
              <input
                type="text"
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                placeholder={activeConcept ? `Try: '${activeConcept.concept.topic}', '${activeConcept.facets.synonyms[0] ?? "synonym"}', 'vertex', 'ws'...` : "Enter search query…"}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 pl-10 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-slate-200"
              />
            </div>

            {/* Expansion */}
            {expandedTerms.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu size={12} className="text-cyan-500" />
                  <span className="text-[10px] uppercase font-bold text-cyan-500">Expansion</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {expandedTerms.map((term, i) => (
                    <span
                      key={i}
                      className={`text-[10px] px-2 py-1 rounded border ${
                        term === query.trim().toLowerCase()
                          ? "bg-cyan-900/40 border-cyan-500/50 text-cyan-200"
                          : "bg-slate-800 border-slate-700 text-slate-400"
                      }`}
                    >
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Editor content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeConcept ? (
              <>
                {/* Concept metadata editor */}
                <Section
                  title="Concept Metadata"
                  icon={<GitBranch size={14} className="text-slate-500" />}
                >
                  <Field
                    label="topic"
                    value={activeConcept.concept.topic}
                onChange={(v) => updateConceptField("topic", v)}
              />
              <Field
                label="derived_topic"
                value={activeConcept.concept.derived_topic}
                onChange={(v) => updateConceptField("derived_topic", v)}
              />
              <Field
                label="etymology"
                value={activeConcept.concept.etymology}
                onChange={(v) => updateConceptField("etymology", v)}
                textarea
              />
              <Field
                label="definition"
                value={activeConcept.concept.definition}
                onChange={(v) => updateConceptField("definition", v)}
                textarea
              />
            </Section>

            {/* Facets editor */}
            <Section title="Facets" icon={<Hash size={14} className="text-slate-500" />}>
              {(["synonyms", "hyponyms", "related", "hypernyms", "antonyms"] as FacetKey[]).map(
                (k) => (
                  <EditableList
                    key={k}
                    title={k}
                    items={activeConcept.facets[k]}
                    onAdd={(v) => addFacetItem(k, v)}
                    onRemove={(v) => removeFacetItem(k, v)}
                  />
                ),
              )}
            </Section>

            {/* State keywords editor */}
            <Section title="State Keywords" icon={<Boxes size={14} className="text-slate-500" />}>
              {(Object.keys(activeConcept.states) as MeshStateId[]).map((sid) => (
                <EditableList
                  key={sid}
                  title={`state.${sid}.keywords`}
                  items={activeConcept.states[sid].keywords}
                  onAdd={(v) => addKeyword(sid, v)}
                  onRemove={(v) => removeKeyword(sid, v)}
                />
              ))}
            </Section>

            {/* Domain triggers editor */}
            <Section title="Domain Triggers" icon={<Layers size={14} className="text-slate-500" />}>
              {(Object.keys(activeConcept.domains) as Array<Exclude<DomainId, "general">>).map(
                (dk) => (
                  <EditableList
                    key={dk}
                    title={`domain.${dk}.triggers (${activeConcept.domains[dk].label})`}
                    items={activeConcept.domains[dk].triggers}
                    onAdd={(v) => addTrigger(dk, v)}
                    onRemove={(v) => removeTrigger(dk, v)}
                  />
                ),
              )}
            </Section>

            {/* Import */}
            <Section title="Import JSON" icon={<Upload size={14} className="text-slate-500" />}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Schema {SCHEMA_VERSION}
                </span>
                <button
                  onClick={importAllFromText}
                  className="px-3 py-1.5 text-[10px] uppercase font-bold border border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300 flex items-center gap-2"
                >
                  <Upload size={14} /> Import
                </button>
              </div>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste a prior export JSON here…"
                title="Paste exported JSON to import"
                className="w-full h-36 bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              {importError && (
                <div className="mt-2 text-xs text-red-300 border border-red-900/50 bg-red-950/30 rounded px-2 py-1">
                  Import error: {importError}
                </div>
              )}
            </Section>

            {/* Engineering preview */}
            <Section
              title="Engineering Preview"
              icon={<Code size={14} className="text-slate-500" />}
            >
              <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-xs text-slate-400 overflow-x-auto">
                <pre>{`struct OntologyConcept {
  id: "${activeConcept.concept.id}",
  topic: "${activeConcept.concept.topic}",
  derived_topic: "${activeConcept.concept.derived_topic}",
  state: StateEnum, // ${activeState.toUpperCase()}
  domain: DomainEnum, // ${activeDomain.toUpperCase()}
  facets: {
    synonyms: ${activeConcept.facets.synonyms.length},
    hyponyms: ${activeConcept.facets.hyponyms.length},
    related: ${activeConcept.facets.related.length},
    hypernyms: ${activeConcept.facets.hypernyms.length},
    antonyms: ${activeConcept.facets.antonyms.length}
  }
}`}</pre>
              </div>
            </Section>
              </>
            ) : null}
          </div>

          {/* Debug Console */}
          <div className="h-44 bg-slate-950 border-t border-slate-800 flex flex-col">
            <div className="flex-none px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Terminal size={12} />
                LOG
              </div>
              <button
                onClick={() => setSearchLog([])}
                className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-1 text-slate-400">
              {searchLog.length === 0 ? (
                <span className="opacity-50">No log entries…</span>
              ) : (
                searchLog.slice(0, 80).map((entry, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-600">[{entry.ts}]</span>
                    <span>{entry.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom export button (nice placement) */}
          <div className="flex-none p-3 border-t border-slate-800 bg-slate-900/50">
            <button
              onClick={exportAll}
              className="w-full px-3 py-2 text-[10px] uppercase font-bold border border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-300 flex items-center justify-center gap-2"
            >
              <Download size={14} /> Export Registry + UI State
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** --------------------------------
 * Small UI Components
 * -------------------------------- */
function Section(props: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded border border-slate-800 bg-slate-950/40">
      <div className="flex items-center gap-2 mb-3">
        {props.icon}
        <h4 className="text-xs font-bold uppercase text-slate-500">{props.title}</h4>
      </div>
      {props.children}
    </div>
  );
}

function Field(props: Readonly<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}>) {
  return (
    <div className="mb-3">
      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
        {props.label}
      </label>
      {props.textarea ? (
        <textarea
          aria-label={props.label}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          rows={3}
        />
      ) : (
        <input
          aria-label={props.label}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
        />
      )}
    </div>
  );
}

function EditableList(props: {
  title: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase font-bold text-slate-500">{props.title}</span>
        <span className="text-[10px] text-slate-600">{props.items.length}</span>
      </div>

      <div className="flex gap-2 mb-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add new…"
          className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
        />
        <button
          onClick={() => {
            props.onAdd(value);
            setValue("");
          }}
          className="px-2 py-1 border border-slate-700 rounded bg-slate-900 hover:border-slate-500 text-slate-300 text-[10px] uppercase font-bold flex items-center gap-1"
          title="Add"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {props.items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-200"
          >
            <span>{item}</span>
            <button
              onClick={() => props.onRemove(item)}
              className="text-slate-400 hover:text-slate-200"
              title="Remove"
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
