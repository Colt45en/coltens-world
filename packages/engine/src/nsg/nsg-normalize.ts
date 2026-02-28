/**
 * NSG v1.0 Pass 1 — Normalization (Canonicalization Layer)
 *
 * Goal: canonical structure before inference and ring evaluation.
 * Traversal: Postorder, left-to-right child order.
 *
 * Rules (fixed order per visited node):
 * 1. Map canonicalization (features/payload key sorting, string NFC)
 * 2. Atom canonicalization (namespace normalization)
 * 3. Drop empty metadata ([] / {})
 * 4. Seal canonicalization (postfix → Seal(node) form if needed)
 * 5. Flatten associative shapes (Fuse, Alt; preserve order)
 * 6. Group elimination (if any survive parse)
 */

import type {
    Alt,
    Amp,
    ASTNode,
    Features,
    Flow,
    Fuse,
    Group,
    Link,
    Payload,
    Query,
    RingApply,
    Seal,
    Split,
    Term
} from "./nsg-ast";

/**
 * Focus path: array of child indices used for node addressing in traversal.
 * Enables deterministic rule tagging and error reporting.
 */
export type FocusPath = number[];

/**
 * Normalization context: tracks path, parent, rewrite count.
 */
interface NormalizationContext {
  focus_path: FocusPath;
  rewrite_count: number;
}

/**
 * Canonicalize a features map: sorted keys, string NFC.
 */
function canonicalizeFeatures(features: Features): Features {
  const entries = Object.entries(features)
    .map(([k, v]) => [k.normalize("NFC"), v] as const)
    .sort((a, b) => (a[0] as string).localeCompare(b[0] as string));
  return Object.fromEntries(entries);
}

/**
 * Canonicalize a payload map: sorted keys (excluding internal rewrite markers).
 */
function canonicalizePayload(payload: Payload): Payload {
  const entries = Object.entries(payload)
    .map(([k, v]) => [k.normalize("NFC"), v] as const)
    .sort((a, b) => (a[0] as string).localeCompare(b[0] as string));
  return Object.fromEntries(entries);
}

/**
 * Normalize an atom string: lowercase, trim, NFC.
 */
function normalizeAtom(atom: string): string {
  return atom.trim().toLocaleLowerCase().normalize("NFC");
}

/**
 * Drop empty metadata from a node.
 */
function dropEmptyMeta(
  node: ASTNode
): ASTNode {
  const result = { ...node };
  if (node.kind === "Term" || node.kind === "Fuse" || node.kind === "Alt") {
    if (
      (node as any).features &&
      Object.keys((node as any).features).length === 0
    ) {
      (result as any).features = {};
    }
    if ((node as any).payload && Object.keys((node as any).payload).length === 0) {
      (result as any).payload = {};
    }
  }
  return result;
}

/**
 * Flatten associative shapes (Fuse, Alt) — recursively inline their operands.
 * Preserves left-to-right order.
 */
function flattenAssociative(node: ASTNode): ASTNode {
  if (node.kind === "Fuse") {
    const fuse = node as Fuse;
    const flatChildren: ASTNode[] = [];

    const collect = (n: ASTNode) => {
      if (n.kind === "Fuse") {
        const inner = n as Fuse;
        inner.children.forEach(collect);
      } else {
        flatChildren.push(n);
      }
    };

    fuse.children.forEach(collect);
    return {
      ...fuse,
      children: flatChildren,
    };
  }

  if (node.kind === "Alt") {
    const alt = node as Alt;
    const flatChildren: ASTNode[] = [];

    const collect = (n: ASTNode) => {
      if (n.kind === "Alt") {
        const inner = n as Alt;
        inner.children.forEach(collect);
      } else {
        flatChildren.push(n);
      }
    };

    alt.children.forEach(collect);
    return {
      ...alt,
      children: flatChildren,
    };
  }

  return node;
}

/**
 * Recursively normalize an AST node (postorder traversal).
 */
function normalizeNode(
  node: ASTNode,
  ctx: NormalizationContext
): ASTNode {
  // Postorder: normalize children first
  let normalized: ASTNode;

  switch (node.kind) {
    case "Term": {
      const term = node as Term;
      normalized = {
        ...term,
        atom: normalizeAtom(term.atom),
        features: canonicalizeFeatures(term.features),
        payload: canonicalizePayload(term.payload),
      };
      break;
    }

    case "Fuse": {
      const fuse = node as Fuse;
      const normChildren = fuse.children.map((child, i) =>
        normalizeNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
      );
      normalized = flattenAssociative({
        ...fuse,
        children: normChildren,
        features: canonicalizeFeatures(fuse.features),
        payload: canonicalizePayload(fuse.payload),
      });
      break;
    }

    case "Alt": {
      const alt = node as Alt;
      const normChildren = alt.children.map((child, i) =>
        normalizeNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
      );
      normalized = flattenAssociative({
        ...alt,
        children: normChildren,
        features: canonicalizeFeatures(alt.features),
        payload: canonicalizePayload(alt.payload),
      });
      break;
    }

    case "Amp": {
      const amp = node as Amp;
      normalized = {
        ...amp,
        children: [
          normalizeNode(amp.children[0], { ...ctx, focus_path: [...ctx.focus_path, 0] }),
          normalizeNode(amp.children[1], { ...ctx, focus_path: [...ctx.focus_path, 1] }),
        ],
        features: canonicalizeFeatures(amp.features),
        payload: canonicalizePayload(amp.payload),
      };
      break;
    }

    case "Split": {
      const split = node as Split;
      normalized = {
        ...split,
        children: [
          normalizeNode(split.children[0], { ...ctx, focus_path: [...ctx.focus_path, 0] }),
          normalizeNode(split.children[1], { ...ctx, focus_path: [...ctx.focus_path, 1] }),
        ],
        features: canonicalizeFeatures(split.features),
        payload: canonicalizePayload(split.payload),
      };
      break;
    }

    case "Flow": {
      const flow = node as Flow;
      normalized = {
        ...flow,
        children: flow.children.map((child, i) =>
          normalizeNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
        ),
        features: canonicalizeFeatures(flow.features),
        payload: canonicalizePayload(flow.payload),
      };
      break;
    }

    case "Link": {
      const link = node as Link;
      normalized = {
        ...link,
        children: link.children.map((child, i) =>
          normalizeNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
        ),
        features: canonicalizeFeatures(link.features),
        payload: canonicalizePayload(link.payload),
      };
      break;
    }

    case "Query": {
      const query = node as Query;
      normalized = {
        ...query,
        body: normalizeNode(query.body, { ...ctx, focus_path: [...ctx.focus_path, 0] }),
        payload: canonicalizePayload(query.payload),
      };
      break;
    }

    case "RingApply": {
      const ringApply = node as RingApply;
      normalized = {
        ...ringApply,
        body: normalizeNode(ringApply.body, { ...ctx, focus_path: [...ctx.focus_path, 0] }),
        payload: canonicalizePayload(ringApply.payload),
      };
      break;
    }

    case "Seal": {
      const seal = node as Seal;
      normalized = {
        ...seal,
        body: normalizeNode(seal.body, { ...ctx, focus_path: [...ctx.focus_path, 0] }),
      };
      break;
    }

    case "Group": {
      // Group elimination: return the body directly
      const group = node as Group;
      normalized = normalizeNode(group.body, ctx);
      ctx.rewrite_count++;
      break;
    }

    default:
      normalized = node;
  }

  // Rule 3: Drop empty metadata
  normalized = dropEmptyMeta(normalized);

  return normalized;
}

/**
 * Main normalization pass.
 * Input: AST
 * Output: Canonical AST, rewrite count
 */
export function normalize(node: ASTNode): { node: ASTNode; rewrite_count: number } {
  const ctx: NormalizationContext = {
    focus_path: [],
    rewrite_count: 0,
  };
  const normalized = normalizeNode(node, ctx);
  return {
    node: normalized,
    rewrite_count: ctx.rewrite_count,
  };
}

/**
 * Normalize a full program (root nodes).
 */
export function normalizeProgram(
  nodes: ASTNode[]
): { nodes: ASTNode[]; rewrite_count: number } {
  let totalRewrites = 0;
  const normalized = nodes.map((node) => {
    const { node: normalized, rewrite_count } = normalize(node);
    totalRewrites += rewrite_count;
    return normalized;
  });

  return {
    nodes: normalized,
    rewrite_count: totalRewrites,
  };
}
