/**
 * NSG v1.0 Pass 2 — Type Inference + Affix Role Tagging
 *
 * Goal: Deterministic typing, operator typing, affix roles, query candidates.
 * Does NOT yet apply ring-based reasoning (Pass 3).
 *
 * Rules (fixed order per visited node):
 * 1. Term type inference (lexicon → features → UNK)
 * 2. Operator typing (promotion functions)
 * 3. Affix role tagging (only for Fuse chains)
 * 4. Query candidate generation (for Query(Term:LEX) and Query(Fuse...))
 */

import type {
    Alt,
    Amp,
    ASTNode,
    Flow,
    Fuse,
    Link,
    NSGType,
    Query,
    RingApply,
    Seal,
    Split,
    Term
} from "./nsg-ast";
import { lookupLexicon } from "./nsg-lexicon";
import { FocusPath } from "./nsg-normalize";
import {
    isValidType,
    promote,
} from "./nsg-promotion-table";
import { queryDecompose } from "./nsg-query-scorer";

/**
 * Inference context
 */
interface InferenceContext {
  focus_path: FocusPath;
  rewrite_count: number;
}

/**
 * Infer type of a Term from lexicon + features.
 * Rules:
 * 1. If payload.type is set, use it
 * 2. Else, lookup atom in lexicon
 * 3. If found, use lexicon type
 * 4. Else if features indicate type, use features type
 * 5. Else  UNK
 */
function inferTermType(term: Term): NSGType {
  // Already set in payload
  if (term.payload.type && isValidType(term.payload.type as NSGType)) {
    return term.payload.type as NSGType;
  }

  // Lookup in lexicon
  const entry = lookupLexicon(term.atom);
  if (entry) {
    return "LEX";
  }

  // Check features for type hint (feature 'type' or 'kind')
  if (term.features.type && typeof term.features.type === "string") {
    const hinted = term.features.type as NSGType;
    if (isValidType(hinted)) {
      return hinted;
    }
  }

  // Default
  return "UNK";
}

/**
 * Infer type of a Fuse by promoting operand types.
 * Left-to-right: fuse(a, b, c) → promote(promote(a, b), c)
 */
function inferFuseType(children: ASTNode[], ctx: InferenceContext): NSGType {
  if (children.length === 0) return "UNK";
  if (children.length === 1) {
    return getNodeType(children[0], ctx);
  }

  let resultType = getNodeType(children[0], ctx);
  for (let i = 1; i < children.length; i++) {
    const nextType = getNodeType(children[i], ctx);
    const promoted = promote("fuse" as any, resultType, nextType);
    if (promoted && isValidType(promoted as NSGType)) {
      resultType = promoted as NSGType;
    }
  }

  return resultType;
}

/**
 * Get the type of any AST node (recursive).
 */
function getNodeType(node: ASTNode, ctx: InferenceContext): NSGType {
  switch (node.kind) {
    case "Term":
      return inferTermType(node as Term);
    case "Fuse":
      return inferFuseType((node as Fuse).children, ctx);
    case "Alt":
      // Alt type: union of child types (for now, just use first)
      return getNodeType((node as Alt).children[0], ctx);
    case "Amp":
      return promote("amp", getNodeType((node as Amp).children[0], ctx), getNodeType((node as Amp).children[1], ctx)) as NSGType || "UNK";
    case "Split":
      return "CMP";
    case "Flow":
      return getNodeType((node as Flow).children[(node as Flow).children.length - 1], ctx);
    case "Link":
      return "PAIR";
    case "Query":
      return getNodeType((node as Query).body, ctx);
    case "RingApply":
      return getNodeType((node as RingApply).body, ctx);
    case "Seal":
      return getNodeType((node as Seal).body, ctx);
    default:
      return "UNK";
  }
}

/**
 * Tag affix roles in a Fuse chain (only for Fuse with Term operands).
 * Assigns: role ("prefix" | "infix" | "suffix"), slot (position), optional morph_class
 */
function tagAffixRoles(fuse: Fuse, ctx: InferenceContext): Fuse {
  const children = fuse.children;
  const result = { ...fuse } as any;

  // Only tag if all children are Terms
  const allTerms = children.every((ch) => ch.kind === "Term");
  if (!allTerms) return fuse;

  const tagged_children = children.map((child, idx) => {
    if (child.kind !== "Term") return child;

    const term = child as Term;
    const entry = lookupLexicon(term.atom);

    const newPayload = { ...term.payload };

    // Determine role
    if (idx === 0) {
      newPayload.role = "prefix";
    } else if (idx === children.length - 1 && children.length > 1) {
      newPayload.role = "suffix";
    } else if (children.length > 2) {
      newPayload.role = "infix";
    }

    newPayload.slot = idx;

    if (entry) {
      newPayload.morph_class = entry.morph_class;
    }

    return {
      ...term,
      payload: newPayload,
    };
  });

  result.children = tagged_children;
  return result;
}

/**
 * Generate query candidates for Query nodes (only for LEX/Fuse operands).
 */
function generateQueryCandidates(query: Query, ctx: InferenceContext): Query {
  const body = query.body;
  const bodyType = getNodeType(body, ctx);

  // Only generate candidates if body is LEX or Fuse
  if (bodyType !== "LEX" && body.kind !== "Fuse") {
    return query;
  }

  // For Terms, use queryDecompose
  if (body.kind === "Term") {
    const term = body as Term;
    const decomposition = queryDecompose(term);

    // Store candidates in payload
    const newPayload = { ...query.payload };
    newPayload.candidates = decomposition.ranked_candidates as any;
    newPayload.best_candidate = decomposition.best_candidate as any;

    return {
      ...query,
      payload: newPayload,
    };
  }

  return query;
}

/**
 * Recursively infer types on an AST node (postorder).
 */
function inferNode(
  node: ASTNode,
  ctx: InferenceContext
): ASTNode {
  // Postorder: infer children first
  let inferred: ASTNode;

  switch (node.kind) {
    case "Term": {
      const term = node as Term;
      const inferredType = inferTermType(term);
      const newPayload = { ...term.payload };
      newPayload.inferred_type = inferredType;
      inferred = {
        ...term,
        payload: newPayload,
      };
      break;
    }

    case "Fuse": {
      const fuse = node as Fuse;
      const normChildren = fuse.children.map((child, i) =>
        inferNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
      );

      let withFuse = {
        ...fuse,
        children: normChildren,
      } as Fuse;

      // Infer Fuse type
      const fuseType = inferFuseType(normChildren, ctx);
      const fusePayload = { ...fuse.payload };
      fusePayload.inferred_type = fuseType;
      withFuse = {
        ...withFuse,
        payload: fusePayload,
      };

      // Tag affix roles
      inferred = tagAffixRoles(withFuse, ctx);
      break;
    }

    case "Alt": {
      const alt = node as Alt;
      const normChildren = alt.children.map((child, i) =>
        inferNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
      );
      inferred = {
        ...alt,
        children: normChildren,
      };
      break;
    }

    case "Amp": {
      const amp = node as Amp;
      const left = inferNode(amp.children[0], { ...ctx, focus_path: [...ctx.focus_path, 0] });
      const right = inferNode(amp.children[1], { ...ctx, focus_path: [...ctx.focus_path, 1] });

      const ampType = promote("amp", getNodeType(left, ctx), getNodeType(right, ctx)) as NSGType || "UNK";
      const ampPayload = { ...amp.payload };
      ampPayload.inferred_type = ampType;

      inferred = {
        ...amp,
        children: [left, right],
        payload: ampPayload,
      };
      break;
    }

    case "Split": {
      const split = node as Split;
      const operand0 = inferNode(split.children[0], { ...ctx, focus_path: [...ctx.focus_path, 0] });
      const operand1 = inferNode(split.children[1], { ...ctx, focus_path: [...ctx.focus_path, 1] });
      const splitPayload = { ...split.payload };
      splitPayload.inferred_type = "CMP";
      inferred = {
        ...split,
        children: [operand0, operand1],
        payload: splitPayload,
      };
      break;
    }

    case "Flow": {
      const flow = node as Flow;
      const children = flow.children.map((child, i) =>
        inferNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
      );

      const flowType = getNodeType(children[children.length - 1], ctx);
      const flowPayload = { ...flow.payload };
      flowPayload.inferred_type = flowType;

      inferred = {
        ...flow,
        children,
        payload: flowPayload,
      };
      break;
    }

    case "Link": {
      const link = node as Link;
      const children = link.children.map((child, i) =>
        inferNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
      );

      const linkPayload = { ...link.payload };
      linkPayload.inferred_type = "PAIR";

      inferred = {
        ...link,
        children,
        payload: linkPayload,
      };
      break;
    }

    case "Query": {
      const query = node as Query;
      const body = inferNode(query.body, { ...ctx, focus_path: [...ctx.focus_path, 0] });
      let withBody = {
        ...query,
        body,
      } as Query;

      // Generate query candidates
      inferred = generateQueryCandidates(withBody, ctx);
      break;
    }

    case "RingApply": {
      const ringApply = node as RingApply;
      const body = inferNode(ringApply.body, { ...ctx, focus_path: [...ctx.focus_path, 0] });

      inferred = {
        ...ringApply,
        body,
      };
      break;
    }

    case "Seal": {
      const seal = node as Seal;
      const body = inferNode(seal.body, { ...ctx, focus_path: [...ctx.focus_path, 0] });

      inferred = {
        ...seal,
        body,
      };
      break;
    }

    default:
      inferred = node;
  }

  return inferred;
}

/**
 * Main inference pass.
 */
export function infer(node: ASTNode): { node: ASTNode; rewrite_count: number } {
  const ctx: InferenceContext = {
    focus_path: [],
    rewrite_count: 0,
  };
  const inferred = inferNode(node, ctx);
  return {
    node: inferred,
    rewrite_count: ctx.rewrite_count,
  };
}

/**
 * Infer a full program.
 */
export function inferProgram(
  nodes: ASTNode[]
): { nodes: ASTNode[]; rewrite_count: number } {
  let totalRewrites = 0;
  const inferred = nodes.map((node) => {
    const { node: inferred, rewrite_count } = infer(node);
    totalRewrites += rewrite_count;
    return inferred;
  });

  return {
    nodes: inferred,
    rewrite_count: totalRewrites,
  };
}
