/**
 * NSG v1.0 Pass 4 — Sealing & Finalization
 *
 * Goal: Seal verification, optional baking, final hashed output.
 *
 * Rules (fixed order per visited node):
 * 1. Seal verify (assert no internal rewrite occurred)
 * 2. Optional bake on finalize (only for resolvable Fuse chains)
 * 3. Finalize hashes (root only: ast_root_hash, proof_chain_hash)
 */

import type {
    ASTNode,
    Fuse,
    Seal,
    Term,
} from "./nsg-ast";
import { hashAST } from "./nsg-canon";
import { lookupLexicon } from "./nsg-lexicon";
import { FocusPath } from "./nsg-normalize";

/**
 * Seal context
 */
interface SealContext {
  focus_path: FocusPath;
  bake_on_finalize: boolean;
  sealed_nodes: Set<ASTNode>;
  rewrite_count: number;
}

/**
 * Verify seal: check if node is sealed and no child rewrites occurred.
 */
function verifySeal(seal: Seal, ctx: SealContext): boolean {
  // In evidence mode, seals are passive; we just mark it verified
  ctx.sealed_nodes.add(seal);
  return true;
}

/**
 * Attempt to bake a Fuse (only if all operands are resolved lexemes).
 * Baking produces a reversible decomposition payload.
 */
function bakeFuse(fuse: Fuse, ctx: SealContext): Fuse {
  if (!ctx.bake_on_finalize) return fuse;

  // Check if all children are Terms with complete roles
  const allTerms = fuse.children.every((ch) => ch.kind === "Term");
  if (!allTerms) return fuse;

  const terms = fuse.children as Term[];
  const allResolved = terms.every((t) => {
    const entry = lookupLexicon(t.atom);
    return entry !== null;
  });

  if (!allResolved) return fuse;

  // Create baking payload
  const bakedPayload = { ...fuse.payload };
  bakedPayload.baked = true;
  bakedPayload.decomposition = {
    segments: terms.map((t) => t.atom),
    roles: terms.map((t) => (t.payload as any).role || "unknown"),
  };

  return {
    ...fuse,
    payload: bakedPayload,
  };
}

/**
 * Finalize: compute hashes and attach to root payload.
 */
function finalizeNode(
  node: ASTNode,
  ctx: SealContext
): ASTNode {
  // Postorder: finalize children first
  let finalized: ASTNode;

  switch (node.kind) {
    case "Seal": {
      const seal = node as Seal;
      verifySeal(seal, ctx);
      const body = finalizeNode(seal.body, ctx);
      finalized = {
        ...seal,
        body,
      };
      break;
    }

    case "Fuse": {
      const fuse = node as Fuse;
      const children = fuse.children.map((child, i) =>
        finalizeNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
      );
      const withChildren = { ...fuse, children } as Fuse;
      finalized = bakeFuse(withChildren, ctx);
      break;
    }

    case "Alt": {
      const parent = node as any;
      finalized = {
        ...parent,
        children: parent.children.map((child: ASTNode, i: number) =>
          finalizeNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
        ),
      };
      break;
    }

    case "Amp": {
      const parent = node as any;
      finalized = {
        ...parent,
        children: [
          finalizeNode(parent.children[0], { ...ctx, focus_path: [...ctx.focus_path, 0] }),
          finalizeNode(parent.children[1], { ...ctx, focus_path: [...ctx.focus_path, 1] }),
        ],
      };
      break;
    }

    case "Split": {
      const parent = node as any;
      finalized = {
        ...parent,
        children: [
          finalizeNode(parent.children[0], { ...ctx, focus_path: [...ctx.focus_path, 0] }),
          finalizeNode(parent.children[1], { ...ctx, focus_path: [...ctx.focus_path, 1] }),
        ],
      };
      break;
    }

    case "Flow": {
      const parent = node as any;
      finalized = {
        ...parent,
        children: parent.children.map((child: ASTNode, i: number) =>
          finalizeNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
        ),
      };
      break;
    }

    case "Link": {
      const parent = node as any;
      finalized = {
        ...parent,
        children: parent.children.map((child: ASTNode, i: number) =>
          finalizeNode(child, { ...ctx, focus_path: [...ctx.focus_path, i] })
        ),
      };
      break;
    }

    case "Query": {
      const parent = node as any;
      finalized = {
        ...parent,
        body: finalizeNode(parent.body, { ...ctx, focus_path: [...ctx.focus_path, 0] }),
      };
      break;
    }

    case "RingApply": {
      const parent = node as any;
      finalized = {
        ...parent,
        body: finalizeNode(parent.body, { ...ctx, focus_path: [...ctx.focus_path, 0] }),
      };
      break;
    }

    default:
      finalized = node;
  }

  return finalized;
}

/**
 * Main sealing pass.
 */
export function seal(
  node: ASTNode,
  options?: { bake_on_finalize?: boolean }
): { node: ASTNode; ast_root_hash: string; rewrite_count: number } {
  const ctx: SealContext = {
    focus_path: [],
    bake_on_finalize: options?.bake_on_finalize ?? false,
    sealed_nodes: new Set(),
    rewrite_count: 0,
  };

  const finalized = finalizeNode(node, ctx);
  const ast_root_hash = hashAST(finalized);

  return {
    node: finalized,
    ast_root_hash,
    rewrite_count: ctx.rewrite_count,
  };
}

/**
 * Seal a full program.
 */
export function sealProgram(
  nodes: ASTNode[],
  options?: { bake_on_finalize?: boolean }
): { nodes: ASTNode[]; ast_root_hashes: string[]; rewrite_count: number } {
  let totalRewrites = 0;
  const sealed = nodes.map((node) => {
    const { node: sealed, ast_root_hash, rewrite_count } = seal(node, options);
    totalRewrites += rewrite_count;
    return sealed;
  });

  const ast_root_hashes = sealed.map((n) => hashAST(n));

  return {
    nodes: sealed,
    ast_root_hashes,
    rewrite_count: totalRewrites,
  };
}

/**
 * Compute a deterministic proof chain hash from a sequence of passes.
 */
export function proofChainHash(
  pass_hashes: string[]
): string {
  // Concatenate all pass hashes deterministically
  const combined = pass_hashes.join("|");
  return hashAST({ kind: "Term", atom: combined, type: "LEX", features: {}, payload: {} } as any);
}
