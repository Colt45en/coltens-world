/**
 * NSG v1.0 Ring Registry
 *
 * 15 linguistic discipline rings (lenses for interpretation + rewrite rules).
 * Deterministic: fixed ring order, locked rule order, deterministic scoring.
 */

import type { ASTNode, NSGType } from "./nsg-ast";

/**
 * Ring definition: a linguistic discipline lens
 */
export interface RingDef {
  id: string;
  name: string;
  description: string;
  input_types: NSGType[];
  scoring?: (expr: ASTNode) => number; // deterministic scoring function (0.0-1.0)
  constraints?: (expr: ASTNode) => boolean;
  rewrite_rules?: string[]; // IDs of rules active in this ring
}

/**
 * Ring Registry: 15 linguistic rings in FIXED order
 * Order matters for determinism; never vary.
 */
export const RINGS: RingDef[] = [
  // 1. Computational
  {
    id: "computational",
    name: "Computational",
    description: "Processing model, constraints, algorithms",
    input_types: ["CMP"],
    constraints: (expr) => true,
  },

  // 2. Contact (language contact, code-switching)
  {
    id: "contact",
    name: "Contact",
    description: "Language contact, multilingual interference, code-switching",
    input_types: ["LEX", "PHO", "SEM"],
    constraints: (expr) => expr.kind === "Link",
  },

  // 3. Descriptive
  {
    id: "descriptive",
    name: "Descriptive",
    description: "Systematic inventory, categorization",
    input_types: ["PHO", "MOR", "SYN", "SEM"],
    constraints: (expr) => true,
  },

  // 4. Historical (diachronic, sound change, semantic shift)
  {
    id: "historical",
    name: "Historical",
    description: "Diachronic change, sound change, semantic shift, etymology",
    input_types: ["LEX", "PHO", "SEM", "HIS"],
    constraints: (expr) => expr.kind === "Flow",
  },

  // 5. Acquisition (language learning, first language, second language)
  {
    id: "acquisition",
    name: "Acquisition",
    description: "Language learning, developmental stages, grammar induction",
    input_types: ["MOR", "LEX", "SYN"],
    constraints: (expr) => true,
  },

  // 6. Morphology (affixation, morphotactics, inflection)
  {
    id: "morphology",
    name: "Morphology",
    description: "Affixation, morphotactics, inflection, derivation",
    input_types: ["MOR", "LEX"],
    constraints: (expr) => expr.kind === "Fuse" || expr.kind === "Term",
    scoring: (expr) => {
      // Higher score for Fuse with multiple children (compound morphology)
      if (expr.kind === "Fuse" && "children" in expr) {
        return Math.min(expr.children.length / 5, 1.0); // cap at 1.0
      }
      return 0.5;
    },
  },

  // 7. Phonetics (acoustic, articulatory, phonetic inventory)
  {
    id: "phonetics",
    name: "Phonetics",
    description: "Acoustic, articulatory, phonetic inventory, coarticulation",
    input_types: ["PHO"],
    constraints: (expr) => expr.kind === "Term",
  },

  // 8. Phonology (sound patterns, rules, distinctive features)
  {
    id: "phonology",
    name: "Phonology",
    description: "Sound patterns, phonological rules, distinctive features",
    input_types: ["PHO", "MOR"],
    constraints: (expr) => true,
  },

  // 9. Pragmatics (discourse, speech acts, implicature)
  {
    id: "pragmatics",
    name: "Pragmatics",
    description: "Discourse, speech acts, conversational implicature, context",
    input_types: ["PRG", "LEX", "SEM"],
    constraints: (expr) => expr.kind === "Query" || expr.kind === "Term",
  },

  // 10. Prosody (stress, intonation, rhythm)
  {
    id: "prosody",
    name: "Prosody",
    description: "Stress, intonation, rhythm, tone, suprasegmental features",
    input_types: ["PHO", "MOR", "SYN"],
    constraints: (expr) => true,
  },

  // 11. Psycholinguistics (mental representation, processing, comprehension)
  {
    id: "psycholinguistics",
    name: "Psycholinguistics",
    description: "Mental representation, comprehension, processing, memory",
    input_types: ["LEX", "SYN", "SEM"],
    constraints: (expr) => true,
  },

  // 12. Semantics (meaning, reference, conceptual structure)
  {
    id: "semantics",
    name: "Semantics",
    description: "Meaning, reference, conceptual structure, semantic fields",
    input_types: ["SEM", "LEX"],
    constraints: (expr) => true,
    scoring: (expr) => {
      // Higher score for terms with payloads (semantic features)
      if (expr.kind === "Term" && "payload" in expr) {
        return Math.min(Object.keys(expr.payload).length / 5, 1.0);
      }
      return 0.3;
    },
  },

  // 13. Sociolinguistics (dialect, register, variation, identity)
  {
    id: "sociolinguistics",
    name: "Sociolinguistics",
    description: "Dialect, register, social variation, linguistic identity, prestige",
    input_types: ["SOC", "LEX", "SEM"],
    constraints: (expr) => "features" in expr,
  },

  // 14. Syntax (phrase structure, dependencies, word order)
  {
    id: "syntax",
    name: "Syntax",
    description: "Phrase structure, dependencies, word order, constituent structure",
    input_types: ["SYN", "LEX"],
    constraints: (expr) => expr.kind === "Fuse" || expr.kind === "Flow",
  },

  // 15. Typology (language types, universals, classification)
  {
    id: "typology",
    name: "Typology",
    description: "Language types, linguistic universals, comparative classification",
    input_types: ["TYP", "SYN"],
    constraints: (expr) => expr.kind === "Alt" || expr.kind === "Flow",
  },
];

/**
 * Get ring by ID (deterministic lookup)
 */
export function getRingByID(id: string): RingDef | null {
  return RINGS.find((r) => r.id === id) ?? null;
}

/**
 * Get all rings in order (deterministic)
 */
export function getAllRings(): RingDef[] {
  return [...RINGS]; // return copy to prevent mutation
}

/**
 * Get rings applicable to a given input type
 */
export function getRingsForType(type: NSGType): RingDef[] {
  return RINGS.filter((r) => r.input_types.includes(type));
}

/**
 * Determine if a ring applies to an expression (constraint check)
 */
export function ringApplies(ring: RingDef, expr: ASTNode): boolean {
  if (ring.constraints) {
    return ring.constraints(expr);
  }
  return true; // default: ring applies
}

/**
 * Score an expression within a ring's context (deterministic)
 * Returns 0.0 - 1.0
 */
export function scoreInRing(ring: RingDef, expr: ASTNode): number {
  if (!ring.scoring) return 0.5; // default neutral score
  const score = ring.scoring(expr);
  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}

/**
 * Ring registry statistics
 */
export function getRingStats() {
  return {
    total_rings: RINGS.length,
    ring_ids: RINGS.map((r) => r.id),
    by_type: Array.from(
      new Set(RINGS.flatMap((r) => r.input_types))
    ).reduce(
      (acc, type) => {
        acc[type] = RINGS.filter((r) => r.input_types.includes(type)).length;
        return acc;
      },
      {} as Record<NSGType, number>
    ),
  };
}
