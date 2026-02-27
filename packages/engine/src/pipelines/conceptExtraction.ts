/**
 * Concept Extraction Pipeline
 *
 * Deterministic metaprocess pipeline:
 * - Tokenizes documents from events
 * - Counts term frequencies
 * - Creates concept graph with co-occurrence edges
 * - Stable ordering, content-addressed IDs
 * - Emits observations (concept.graph + claims)
 */

import type { Observation } from "@world-engine/contracts";
import { contentAddressedId } from "../determinism/canon";
import type { Pipeline } from "../world/runtime";

export type ConceptExtractionConfig = {
  windowSize: number; // sliding window for co-occurrence (default 4)
  minFreq: number; // minimum term frequency to include (default 2)
  maxNodes: number; // max concept nodes to extract (default 500)
};

export function createConceptExtractionPipeline(
  config: ConceptExtractionConfig
): Pipeline {
  const cfg = {
    windowSize: Math.max(2, Math.floor(config.windowSize)),
    minFreq: Math.max(1, Math.floor(config.minFreq)),
    maxNodes: Math.max(10, Math.floor(config.maxNodes)),
  };

  return {
    name: "metaprocess.concept_extraction.v1",
    run: ({ events, prior, now_utc }: any) => {
      void prior; // unused

      // Collect documents from events deterministically
      const docs: Array<{ doc_id: string; text: string }> = [];
      for (const e of events) {
        if (e.type !== "document.ingest") continue;
        const payload = e.payload as Record<string, unknown>;
        const docId = String(payload.doc_id ?? e.id);
        const text = String(payload.text ?? "");
        docs.push({ doc_id: docId, text });
      }
      docs.sort((a, b) => a.doc_id.localeCompare(b.doc_id));

      if (docs.length === 0) return [];

      // Tokenize + count frequencies
      const freq = new Map<string, number>();
      const tokenizedDocs: Array<{ doc_id: string; tokens: string[] }> = [];

      for (const d of docs) {
        const tokens = tokenize(d.text);
        tokenizedDocs.push({ doc_id: d.doc_id, tokens });
        for (const t of tokens) {
          freq.set(t, (freq.get(t) ?? 0) + 1);
        }
      }

      // Select concept nodes
      const candidates = Array.from(freq.entries())
        .filter(([, c]) => c >= cfg.minFreq)
        .sort((a, b) => {
          const dc = b[1] - a[1];
          return dc !== 0 ? dc : a[0].localeCompare(b[0]);
        })
        .slice(0, cfg.maxNodes);

      const keep = new Set(candidates.map(([t]) => t));

      const nodes = candidates
        .map(([label, frequency]) => {
          const base = { label, frequency };
          const id = contentAddressedId("concept", base);
          return { id, label, frequency };
        })
        .sort((a, b) => a.id.localeCompare(b.id));

      // Build co-occurrence edges
      const edgeWeight = new Map<string, number>(); // key = from|to (ordered)
      const labelToId = new Map(nodes.map((n) => [n.label, n.id] as const));

      for (const d of tokenizedDocs) {
        const toks: string[] = d.tokens.filter((t: string) => keep.has(t));
        // Sliding window pairs
        for (let i = 0; i < toks.length; i++) {
          const from: string | undefined = toks[i];
          for (
            let j = i + 1;
            j < Math.min(toks.length, i + cfg.windowSize);
            j++
          ) {
            const to = toks[j];
            if (from === to) continue;
            const a = labelToId.get(from!) ?? "";
            const b = labelToId.get(to!) ?? "";
            if (!a || !b) continue;
            const [lo, hi] = a < b ? [a, b] : [b, a];
            const key = `${lo}|${hi}`;
            edgeWeight.set(key, (edgeWeight.get(key) ?? 0) + 1);
          }
        }
      }

      const edges = Array.from(edgeWeight.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, weight]) => {
          const [from, to] = key.split("|");
          const base = { from, to, rel: "co_occurs", weight };
          const id = contentAddressedId("edge", base);
          return { id, ...base };
        });

      // Build concept graph observation
      const graph = {
        ts_utc: now_utc,
        nodes,
        edges,
      };

      const graphId = contentAddressedId("concept_graph", graph);

      const oGraph: Observation = {
        id: contentAddressedId("obs", {
          pipeline: "metaprocess.concept_extraction.v1",
          kind: "concept.graph",
          graphId,
        }),
        pipeline: "metaprocess.concept_extraction.v1",
        ts_utc: now_utc,
        kind: "concept.graph",
        data: { graph_id: graphId, ...graph },
      };

      // Emit claims for top concepts
      const top = nodes
        .slice()
        .sort((a, b) =>
          b.frequency - a.frequency !== 0
            ? b.frequency - a.frequency
            : a.id.localeCompare(b.id)
        )
        .slice(0, 10);

      const claimObs: Observation[] = top.map((n) => ({
        id: contentAddressedId("obs", {
          pipeline: "metaprocess.concept_extraction.v1",
          kind: "claim",
          concept: n.id,
        }),
        pipeline: "metaprocess.concept_extraction.v1",
        ts_utc: now_utc,
        kind: "claim",
        data: {
          subject: "document_corpus",
          predicate: "contains_concept",
          object: n.label,
          confidence: 0.6,
        },
      }));

      // Stable order: graph first, then claims
      claimObs.sort((a, b) => a.id.localeCompare(b.id));
      return [oGraph, ...claimObs];
    },
  };
}

/**
 * Deterministic tokenization:
 * - lowercase
 * - keep letters/digits/underscore
 * - split on whitespace/punctuation
 * - drop short tokens (< 3 chars)
 */
function tokenize(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9_]+/g, " ");
  const raw = clean.split(" ").filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    if (t.length < 3) continue;
    out.push(t);
  }
  return out;
}
