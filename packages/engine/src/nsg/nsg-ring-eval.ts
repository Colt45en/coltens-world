/**
 * NSG v1.0 Pass 3 — Ring Evaluation (Evidence Mode)
 *
 * Goal: Apply ring lenses deterministically, attach evidence.
 * Default mode: Evidence (keep AST, attach payload evidence).
 *
 * Rules (fixed order per visited node):
 * 1. Split analysis (if in RingApply scope)
 * 2. Query evaluation (enrich candidates with ring scoring)
 * 3. RingApply evaluation (close scope, attach evidence)
 */

import type {
    ASTNode,
    Query,
    RingApply,
    Seal,
    Split
} from "./nsg-ast";
import { FocusPath } from "./nsg-normalize";
import { getRingByID, scoreInRing } from "./nsg-ring-registry";

/**
 * Ring evaluation context
 */
interface RingEvalContext {
  focus_path: FocusPath;
  in_ring_scope: boolean;
  current_ring_id: string | null;
  rewrite_count: number;
}

/**
 * Analyze a Split node if in ring scope.
 * Attach analysis results to payload.
 */
function analyzeSplit(split: Split, ctx: RingEvalContext): Split {
  const analysis: any = {
    operand_type: (split.children[0] as any).payload?.inferred_type || "UNK",
    ring_analyzed: ctx.in_ring_scope,
  };

  const newPayload = { ...split.payload, split_analysis: analysis };
  return {
    ...split,
    payload: newPayload,
  };
}

/**
 * Evaluate a Query node with ring scoring (if in ring scope).
 * Enrich candidates with ring scores.
 */
function evaluateQuery(query: Query, ctx: RingEvalContext): Query {
  if (
    !ctx.in_ring_scope ||
    !ctx.current_ring_id ||
    !(query.payload.candidates)
  ) {
    return query;
  }

  const ring = getRingByID(ctx.current_ring_id);
  if (!ring) return query;

  // Enrich candidates with ring score
  const candidates = (query.payload.candidates as any[]) || [];
  const ranked_with_ring_score = candidates.map((cand) => {
    const ring_score = scoreInRing(ring, query.body);
    return {
      ...cand,
      ring_score,
      ring_id: ctx.current_ring_id,
    };
  });

  const newPayload = { ...query.payload };
  newPayload.candidates = ranked_with_ring_score;

  return {
    ...query,
    payload: newPayload,
  };
}

/**
 * Recursively evaluate ring application (postorder).
 */
function ringEvalNode(
  node: ASTNode,
  ctx: RingEvalContext
): ASTNode {
  // Postorder: eval children first
  let evaluated: ASTNode;

  switch (node.kind) {
    case "Split": {
      const split = node as Split;
      const child0 = ringEvalNode(split.children[0], ctx);
      const child1 = ringEvalNode(split.children[1], ctx);
      const analyzed = analyzeSplit({ ...split, children: [child0, child1] } as Split, ctx);
      evaluated = analyzed;
      break;
    }

    case "Query": {
      const query = node as Query;
      const body = ringEvalNode(query.body, ctx);
      let withBody = { ...query, body } as Query;
      evaluated = evaluateQuery(withBody, ctx);
      break;
    }

    case "RingApply": {
      const ringApply = node as RingApply;
      const ringId = ringApply.ring;

      // Open ring scope
      const innerCtx: RingEvalContext = {
        ...ctx,
        in_ring_scope: true,
        current_ring_id: ringId,
        focus_path: [...ctx.focus_path, 0],
      };

      const body = ringEvalNode(ringApply.body, innerCtx);

      // Attach evidence to payload
      const ring = getRingByID(ringId);
      const evidence: any = {
        ring_id: ringId,
        ring_name: ring?.name || "unknown",
        applied: true,
        timestamp: new Date().toISOString().split("T")[0], // Date only, no time
      };

      const newPayload = { ...ringApply.payload };
      newPayload.ring_evidence = evidence;

      evaluated = {
        ...ringApply,
        body,
        payload: newPayload,
      };
      break;
    }

    case "Seal": {
      const seal = node as Seal;
      const body = ringEvalNode(seal.body, ctx);
      evaluated = {
        ...seal,
        body,
      };
      break;
    }

    case "Fuse":
    case "Alt":
    case "Amp":
    case "Flow":
    case "Link": {
      // Generic binary/n-ary nodes: recurse into children
      const parent = node as any;
      const newNode = { ...parent };

      if (parent.children) {
        newNode.children = parent.children.map((child: ASTNode, i: number) =>
          ringEvalNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
        );
      }

      evaluated = newNode;
      break;
    }

    default:
      evaluated = node;
  }

  return evaluated;
}

/**
 * Main ring evaluation pass (evidence mode).
 */
export function ringEval(node: ASTNode): { node: ASTNode; rewrite_count: number } {
  const ctx: RingEvalContext = {
    focus_path: [],
    in_ring_scope: false,
    current_ring_id: null,
    rewrite_count: 0,
  };
  const evaluated = ringEvalNode(node, ctx);
  return {
    node: evaluated,
    rewrite_count: ctx.rewrite_count,
  };
}

/**
 * Ring evaluate a full program.
 */
export function ringEvalProgram(
  nodes: ASTNode[]
): { nodes: ASTNode[]; rewrite_count: number } {
  let totalRewrites = 0;
  const evaluated = nodes.map((node) => {
    const { node: evaluated, rewrite_count } = ringEval(node);
    totalRewrites += rewrite_count;
    return evaluated;
  });

  return {
    nodes: evaluated,
    rewrite_count: totalRewrites,
  };
}
