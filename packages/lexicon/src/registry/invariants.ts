import { z } from "zod";

export type OperatorBase = {
  version: string;
  term: string;
  process_tag: string;
  type: string;
};

export type InvariantIssue = {
  code:
    | "INVALID_SCHEMA"
    | "DUPLICATE_TERM"
    | "DUPLICATE_PROCESS_TAG"
    | "BAD_PROCESS_TAG"
    | "BAD_VERSION"
    | "BAD_DETERMINISTIC_ID";
  message: string;
  term?: string;
  process_tag?: string;
};

export type InvariantCtx = {
  /** current operator being checked */
  op: OperatorBase;
  /** deterministic ID computed from op */
  computed_id: string;
  /** IDs already present */
  seen_ids: Set<string>;
  /** terms already present */
  seen_terms: Set<string>;
  /** process tags already present */
  seen_tags: Set<string>;
};

export type InvariantFn = (ctx: InvariantCtx) => InvariantIssue[];

/**
 * Conservative version format:
 * - lexicon.operator.v1
 * - lexicon.operator.v2
 * You can loosen this later, but a strict format prevents drift.
 */
export function invariantVersionFormat(): InvariantFn {
  const re = /^lexicon\.operator\.v\d+$/;
  return ({ op }) => {
    if (!re.test(op.version)) {
      return [
        {
          code: "BAD_VERSION",
          message: `version must match ${re}. Got: ${op.version}`,
          term: op.term,
          process_tag: op.process_tag,
        },
      ];
    }
    return [];
  };
}

/**
 * Enforce operator tag namespace
 */
export function invariantProcessTagNamespace(): InvariantFn {
  const re = /^prompt\.operator\.[a-z0-9._-]+$/;
  return ({ op }) => {
    if (!re.test(op.process_tag)) {
      return [
        {
          code: "BAD_PROCESS_TAG",
          message: `process_tag must match ${re}. Got: ${op.process_tag}`,
          term: op.term,
          process_tag: op.process_tag,
        },
      ];
    }
    return [];
  };
}

/**
 * Enforce global uniqueness across registry
 */
export function invariantGlobalUniqueness(): InvariantFn {
  return ({ op, seen_terms, seen_tags }) => {
    const issues: InvariantIssue[] = [];

    if (seen_terms.has(op.term)) {
      issues.push({
        code: "DUPLICATE_TERM",
        message: `Duplicate term: ${op.term}`,
        term: op.term,
        process_tag: op.process_tag,
      });
    }
    if (seen_tags.has(op.process_tag)) {
      issues.push({
        code: "DUPLICATE_PROCESS_TAG",
        message: `Duplicate process_tag: ${op.process_tag}`,
        term: op.term,
        process_tag: op.process_tag,
      });
    }

    return issues;
  };
}

/**
 * Enforce deterministic ID stability
 * - If the operator includes an "id" field, it must equal the computed deterministic id.
 * - If it does not include an "id" field, that's fine (registry will store computed id).
 */
export function invariantDeterministicId(): InvariantFn {
  return ({ op, computed_id }) => {
    // If user includes id, validate it matches. Otherwise ignore.
    const maybeId = (op as unknown as { id?: unknown }).id;
    if (typeof maybeId === "string" && maybeId !== computed_id) {
      return [
        {
          code: "BAD_DETERMINISTIC_ID",
          message: `Provided id "${maybeId}" does not match computed deterministic id "${computed_id}".`,
          term: op.term,
          process_tag: op.process_tag,
        },
      ];
    }
    return [];
  };
}

/**
 * Default invariant pack
 */
export function defaultInvariants(): InvariantFn[] {
  return [
    invariantVersionFormat(),
    invariantProcessTagNamespace(),
    invariantGlobalUniqueness(),
    invariantDeterministicId(),
  ];
}

/**
 * Base schema to validate minimum operator contract before storing.
 * (Your operator-specific Zod schema still does the real validation.)
 */
export const OperatorBaseSchema = z
  .object({
    version: z.string().min(1),
    term: z.string().min(1),
    process_tag: z.string().min(1),
    type: z.string().min(1),
  })
  .strict();
