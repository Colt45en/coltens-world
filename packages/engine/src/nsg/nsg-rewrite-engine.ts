/**
 * NSG v1.0 Rewrite Engine Orchestrator
 *
 * Coordinates 4-pass deterministic rewrite pipeline:
 * 1. Normalize (canonicalization)
 * 2. Infer (type inference + affix roles + query candidates)
 * 3. RingEval (ring application, evidence attachment)
 * 4. Seal (verification, optional baking, finalization hashing)
 *
 * Deterministic output: same input → same output (byte-identical).
 */

import type { ASTNode } from "./nsg-ast";
import { hashAST } from "./nsg-canon";
import { infer } from "./nsg-infer";
import { normalize } from "./nsg-normalize";
import { parseNSG } from "./nsg-parser";
import { ProofLedger, computeRunId } from "./nsg-proof-ledger";
import { ringEval } from "./nsg-ring-eval";
import { proofChainHash, seal } from "./nsg-seal";

/**
 * Rewrite policy: fully deterministic configuration
 */
export interface RewritePolicy {
  /** Traversal order: always postorder */
  traversal: "postorder";

  /** Bake Fuse chains on finalize (only if fully resolved) */
  bake_on_finalize: boolean;

  /** Ring evaluation mode: "evidence" (attach payload) or "reduce" (not yet implemented) */
  ring_eval_mode: "evidence" | "reduce";

  /** Flatten Flow chains (a -> (b -> c) becomes a -> b -> c) */
  flatten_flow_chain: boolean;

  /** Emit visit events (verbose logging) */
  emit_visit_events: boolean;
}

/**
 * Rewrite result: AST, hashes, ledger, policy
 */
export interface RewriteResult {
  /** Final AST after all passes */
  ast_root: ASTNode;

  /** Hash of final AST */
  ast_root_hash: string;

  /** Deterministic proof chain hash (all pass hashes combined) */
  proof_chain_hash: string;

  /** Proof ledger (NDJSON events) */
  ledger: ProofLedger;

  /** Policy used for this rewrite */
  policy: RewritePolicy;

  /** Pass results (hashes, rewrite counts) */
  passes: PassResult[];
}

/**
 * Result of a single pass
 */
export interface PassResult {
  pass_index: number;
  pass_name: string;
  rewrite_count: number;
  output_hash: string;
}

/**
 * Default rewrite policy (safe, no baking)
 */
export const DEFAULT_POLICY: RewritePolicy = {
  traversal: "postorder",
  bake_on_finalize: false,
  ring_eval_mode: "evidence",
  flatten_flow_chain: false,
  emit_visit_events: false,
};

/**
 * Compute policy hash (deterministic)
 */
function policyHash(policy: RewritePolicy): string {
  const sorted = {
    traversal: policy.traversal,
    bake_on_finalize: policy.bake_on_finalize,
    ring_eval_mode: policy.ring_eval_mode,
    flatten_flow_chain: policy.flatten_flow_chain,
    emit_visit_events: policy.emit_visit_events,
  };
  return hashAST({
    kind: "Term",
    atom: JSON.stringify(sorted),
    type: "LEX",
    features: {},
    payload: {},
  } as any);
}

/**
 * Execute 4-pass rewrite pipeline on a single AST node.
 */
function rewriteNode(
  node: ASTNode,
  policy: RewritePolicy,
  ledger: ProofLedger
): RewriteResult {
  const passes: PassResult[] = [];
  let current: ASTNode = node;
  const pass_hashes: string[] = [];

  // Pass 1: Normalize
  ledger.emitPassStart(0, "normalize");
  const { node: normalized, rewrite_count: normalize_rewrites } = normalize(current);
  current = normalized;
  const normalize_hash = hashAST(current);
  pass_hashes.push(normalize_hash);
  passes.push({
    pass_index: 0,
    pass_name: "normalize",
    rewrite_count: normalize_rewrites,
    output_hash: normalize_hash,
  });
  ledger.emitPassEnd(0, "normalize", normalize_rewrites, normalize_hash);

  // Pass 2: Infer
  ledger.emitPassStart(1, "infer");
  const { node: inferred, rewrite_count: infer_rewrites } = infer(current);
  current = inferred;
  const infer_hash = hashAST(current);
  pass_hashes.push(infer_hash);
  passes.push({
    pass_index: 1,
    pass_name: "infer",
    rewrite_count: infer_rewrites,
    output_hash: infer_hash,
  });
  ledger.emitPassEnd(1, "infer", infer_rewrites, infer_hash);

  // Pass 3: RingEval
  ledger.emitPassStart(2, "ring_eval");
  const { node: ringed, rewrite_count: ring_rewrites } = ringEval(current);
  current = ringed;
  const ring_hash = hashAST(current);
  pass_hashes.push(ring_hash);
  passes.push({
    pass_index: 2,
    pass_name: "ring_eval",
    rewrite_count: ring_rewrites,
    output_hash: ring_hash,
  });
  ledger.emitPassEnd(2, "ring_eval", ring_rewrites, ring_hash);

  // Pass 4: Seal
  ledger.emitPassStart(3, "seal");
  const { node: sealed, ast_root_hash } = seal(current, {
    bake_on_finalize: policy.bake_on_finalize,
  });
  current = sealed;
  pass_hashes.push(ast_root_hash);
  passes.push({
    pass_index: 3,
    pass_name: "seal",
    rewrite_count: 0,
    output_hash: ast_root_hash,
  });
  ledger.emitPassEnd(3, "seal", 0, ast_root_hash);

  // Compute proof chain hash
  const proof_hash = proofChainHash(pass_hashes);

  // Emit rewrite end
  const total_rewrites =
    normalize_rewrites + infer_rewrites + ring_rewrites;
  ledger.emitRewriteEnd(
    ast_root_hash,
    proof_hash,
    4,
    total_rewrites
  );

  return {
    ast_root: current,
    ast_root_hash,
    proof_chain_hash: proof_hash,
    ledger,
    policy,
    passes,
  };
}

/**
 * Main rewrite API: parse NSG string, execute 4-pass pipeline, return result.
 */
export function rewriteNsg(
  input: string,
  policy?: Partial<RewritePolicy>
): RewriteResult {
  // Merge policy with defaults
  const merged_policy: RewritePolicy = { ...DEFAULT_POLICY, ...policy };

  // Parse input
  const nodes = parseNSG(input);
  if (nodes.length === 0) {
    throw new Error("Empty program");
  }

  const input_hash = hashAST({
    kind: "Term",
    atom: input,
    type: "LEX",
    features: {},
    payload: {},
  } as any);
  const policy_hash = policyHash(merged_policy);
  const run_id = computeRunId(input_hash, policy_hash);

  // Create ledger
  const ledger = new ProofLedger(run_id);
  ledger.emitRewriteStart(input_hash, policy_hash);

  // Process single root node (first in program)
  const result = rewriteNode(nodes[0], merged_policy, ledger);

  return result;
}

/**
 * Rewrite a program (multiple top-level nodes).
 */
export function rewriteProgram(
  input: string,
  policy?: Partial<RewritePolicy>
): { results: RewriteResult[]; combined_ledger: ProofLedger } {
  const merged_policy: RewritePolicy = { ...DEFAULT_POLICY, ...policy };

  // Parse input
  const nodes = parseNSG(input);

  const input_hash = hashAST({
    kind: "Term",
    atom: input,
    type: "LEX",
    features: {},
    payload: {},
  } as any);
  const policy_hash = policyHash(merged_policy);

  // Combine ledgers
  const combined_ledger = new ProofLedger(computeRunId(input_hash, policy_hash));
  combined_ledger.emitRewriteStart(input_hash, policy_hash);

  const results = nodes.map((node) =>
    rewriteNode(node, merged_policy, combined_ledger)
  );

  return { results, combined_ledger };
}

/**
 * Export policy hash for reproducibility checking
 */
export { policyHash };
