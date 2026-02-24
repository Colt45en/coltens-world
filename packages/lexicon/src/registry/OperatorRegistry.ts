import { z } from "zod";
import { createHash } from "node:crypto";
import {
  OperatorBaseSchema,
  type OperatorBase,
  type InvariantFn,
  type InvariantIssue,
  defaultInvariants,
} from "./invariants";

export type OperatorRegistration<S extends z.ZodTypeAny> = Readonly<{
  schema: S;
  entry: z.input<S>;
}>;

export type StoredOperator<S extends z.ZodTypeAny = z.ZodTypeAny> = Readonly<{
  id: string; // deterministic id
  schema: S;
  entry: z.infer<S>;
}>;

export type RegistrySnapshot = Readonly<{
  byTerm: Readonly<Record<string, StoredOperator>>;
  byTag: Readonly<Record<string, StoredOperator>>;
}>;

export class OperatorRegistry {
  private readonly byTerm = new Map<string, StoredOperator>();
  private readonly byTag = new Map<string, StoredOperator>();
  private readonly invariants: InvariantFn[];

  constructor(invariants: InvariantFn[] = defaultInvariants()) {
    this.invariants = invariants.slice();
  }

  /**
   * Deterministic ID = op_<sha256(version|process_tag|term)[:24]>
   * - short enough to be readable
   * - stable across machines
   * - collision-resistant for practical use
   */
  static computeDeterministicId(op: OperatorBase): string {
    const payload = `${op.version}|${op.process_tag}|${op.term}`;
    const hex = createHash("sha256").update(payload, "utf8").digest("hex");
    return `op_${hex.slice(0, 24)}`;
  }

  /**
   * Register an operator:
   * - parse with operator-specific schema
   * - validate base contract (version/term/process_tag/type)
   * - run invariants (uniqueness, namespace, deterministic id)
   * - deep-freeze stored entry
   */
  register<S extends z.ZodTypeAny>(reg: OperatorRegistration<S>): StoredOperator<S> {
    const parsed = reg.schema.parse(reg.entry) as z.infer<S>;
    const base = OperatorBaseSchema.parse({
      version: parsed.version,
      term: parsed.term,
      process_tag: parsed.process_tag,
      type: parsed.type,
    }) as OperatorBase;

    const computed_id = OperatorRegistry.computeDeterministicId(base);

    const issues = this.runInvariants(base, computed_id);
    if (issues.length) {
      const msg = issues.map((i) => `- [${i.code}] ${i.message}`).join("\n");
      throw new Error(`Operator invariant violation(s):\n${msg}`);
    }

    const stored: StoredOperator<S> = deepFreeze({
      id: computed_id,
      schema: reg.schema,
      entry: parsed,
    });

    // Update maps AFTER all validation passes
    this.byTerm.set(base.term, stored as StoredOperator);
    this.byTag.set(base.process_tag, stored as StoredOperator);

    return stored;
  }

  getByTerm(term: string): StoredOperator | undefined {
    return this.byTerm.get(term);
  }

  getByTag(process_tag: string): StoredOperator | undefined {
    return this.byTag.get(process_tag);
  }

  resolve(termOrTag: string): StoredOperator | undefined {
    return this.getByTerm(termOrTag) ?? this.getByTag(termOrTag);
  }

  list(): StoredOperator[] {
    return [...this.byTerm.values()];
  }

  snapshot(): RegistrySnapshot {
    const byTermObj: Record<string, StoredOperator> = Object.create(null);
    const byTagObj: Record<string, StoredOperator> = Object.create(null);

    for (const [k, v] of this.byTerm.entries()) byTermObj[k] = v;
    for (const [k, v] of this.byTag.entries()) byTagObj[k] = v;

    return deepFreeze({ byTerm: byTermObj, byTag: byTagObj });
  }

  private runInvariants(op: OperatorBase, computed_id: string): InvariantIssue[] {
    const seen_terms = new Set(this.byTerm.keys());
    const seen_tags = new Set(this.byTag.keys());
    const seen_ids = new Set([...this.byTerm.values()].map((x) => x.id));

    const ctx = {
      op,
      computed_id,
      seen_ids,
      seen_terms,
      seen_tags,
    };

    return this.invariants.flatMap((inv) => inv(ctx));
  }
}

/**
 * Deep-freeze to prevent mutation of canonical operator entries after registration.
 */
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    Object.freeze(obj);

    // Arrays
    if (Array.isArray(obj)) {
      for (const item of obj) deepFreeze(item);
      return obj;
    }

    // Objects
    const rec = obj as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      deepFreeze(rec[key]);
    }
  }
  return obj;
}
