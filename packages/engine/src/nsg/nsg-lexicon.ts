/**
 * NSG v1.0 Lexicon
 *
 * Morphological lexicon: prefix, root, and suffix tables for affixation.
 * Deterministic: all lookups by canonical key, scores deterministic.
 */

/**
 * Lexicon entry: a morpheme (prefix, root, or suffix)
 */
export interface LexiconEntry {
  canonical: string; // canonical spelling (normalizing case, diacritics)
  type: "MOR" | "LEX"; // morpheme or lexeme
  morph_class: string; // "prefix", "suffix", "root", "stem", "combining_form"
  confidence: number; // 0.0 - 1.0 (morphological certainty)
  meaning?: string; // optional gloss
}

/**
 * Prefix (pre-morpheme) table
 */
export const PREFIXES: Record<string, LexiconEntry> = {
  re: {
    canonical: "re",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.95,
    meaning: "again; back",
  },
  un: {
    canonical: "un",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.95,
    meaning: "negation; reversal",
  },
  dis: {
    canonical: "dis",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.9,
    meaning: "negation; separation",
  },
  pre: {
    canonical: "pre",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.95,
    meaning: "before; prior",
  },
  post: {
    canonical: "post",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.95,
    meaning: "after; later",
  },
  anti: {
    canonical: "anti",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.9,
    meaning: "against; opposite",
  },
  super: {
    canonical: "super",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.9,
    meaning: "above; exceeding",
  },
  hyper: {
    canonical: "hyper",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.85,
    meaning: "excessive; beyond",
  },
  sub: {
    canonical: "sub",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.95,
    meaning: "below; under",
  },
  co: {
    canonical: "co",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.9,
    meaning: "together; joint",
  },
  multi: {
    canonical: "multi",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.9,
    meaning: "many; multiple",
  },
  mono: {
    canonical: "mono",
    type: "MOR",
    morph_class: "prefix",
    confidence: 0.9,
    meaning: "single; one",
  },
};

/**
 * Suffix (post-morpheme) table
 */
export const SUFFIXES: Record<string, LexiconEntry> = {
  ion: {
    canonical: "ion",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "abstract noun formation",
  },
  tion: {
    canonical: "tion",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "abstract noun formation",
  },
  ness: {
    canonical: "ness",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "quality; state",
  },
  ment: {
    canonical: "ment",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "abstract noun formation",
  },
  ity: {
    canonical: "ity",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "quality; condition",
  },
  able: {
    canonical: "able",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "capable of",
  },
  ible: {
    canonical: "ible",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "capable of",
  },
  ful: {
    canonical: "ful",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "full of; characterized by",
  },
  less: {
    canonical: "less",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "without; lacking",
  },
  ly: {
    canonical: "ly",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "manner (adverbial)",
  },
  er: {
    canonical: "er",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.9,
    meaning: "agent; comparative",
  },
  ist: {
    canonical: "ist",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "one who practices; believer",
  },
  ize: {
    canonical: "ize",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "causative; make into",
  },
  ify: {
    canonical: "ify",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "causative; make into",
  },
  ing: {
    canonical: "ing",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.95,
    meaning: "gerund; present participle",
  },
  ed: {
    canonical: "ed",
    type: "MOR",
    morph_class: "suffix",
    confidence: 0.9,
    meaning: "past tense; past participle",
  },
};

/**
 * Root (stem) table: common semantic roots
 */
export const ROOTS: Record<string, LexiconEntry> = {
  struct: {
    canonical: "struct",
    type: "MOR",
    morph_class: "root",
    confidence: 0.95,
    meaning: "arrangement; framework",
  },
  form: {
    canonical: "form",
    type: "MOR",
    morph_class: "root",
    confidence: 0.95,
    meaning: "shape; configuration",
  },
  morph: {
    canonical: "morph",
    type: "MOR",
    morph_class: "root",
    confidence: 0.95,
    meaning: "shape; form",
  },
  graph: {
    canonical: "graph",
    type: "MOR",
    morph_class: "root",
    confidence: 0.95,
    meaning: "write; representation",
  },
  scope: {
    canonical: "scope",
    type: "MOR",
    morph_class: "root",
    confidence: 0.95,
    meaning: "view; instrument for viewing",
  },
  phon: {
    canonical: "phon",
    type: "MOR",
    morph_class: "root",
    confidence: 0.95,
    meaning: "sound; voice",
  },
  phone: {
    canonical: "phone",
    type: "MOR",
    morph_class: "root",
    confidence: 0.95,
    meaning: "sound; voice",
  },
  log: {
    canonical: "log",
    type: "MOR",
    morph_class: "root",
    confidence: 0.95,
    meaning: "word; reason",
  },
  path: {
    canonical: "path",
    type: "MOR",
    morph_class: "root",
    confidence: 0.95,
    meaning: "feeling; disease",
  },
  syntax: {
    canonical: "syntax",
    type: "LEX",
    morph_class: "root",
    confidence: 0.95,
    meaning: "arrangement; grammatical structure",
  },
  semantics: {
    canonical: "semantics",
    type: "LEX",
    morph_class: "root",
    confidence: 0.95,
    meaning: "meaning; interpretation",
  },
};

/**
 * Lexicon query: lookup a morpheme by canonical key
 * Returns entry if found, else null
 */
export function lookupLexicon(
  key: string,
  kind: "prefix" | "suffix" | "root" | "all" = "all"
): LexiconEntry | null {
  const normalized = key.toLowerCase();

  if (kind === "prefix" || kind === "all") {
    if (normalized in PREFIXES) {
      const entry = PREFIXES[normalized as keyof typeof PREFIXES];
      if (entry) return entry;
    }
  }
  if (kind === "suffix" || kind === "all") {
    if (normalized in SUFFIXES) {
      const entry = SUFFIXES[normalized as keyof typeof SUFFIXES];
      if (entry) return entry;
    }
  }
  if (kind === "root" || kind === "all") {
    if (normalized in ROOTS) {
      const entry = ROOTS[normalized as keyof typeof ROOTS];
      if (entry) return entry;
    }
  }

  return null;
}

/**
 * Get all morphology classes
 */
export function getAllMorphClasses(): string[] {
  const classes = new Set<string>();
  [...Object.values(PREFIXES), ...Object.values(SUFFIXES), ...Object.values(ROOTS)].forEach(
    (e) => classes.add(e.morph_class)
  );
  return Array.from(classes).sort();
}

/**
 * Get lexicon statistics
 */
export function getLexiconStats() {
  return {
    prefixes: Object.keys(PREFIXES).length,
    suffixes: Object.keys(SUFFIXES).length,
    roots: Object.keys(ROOTS).length,
    total: Object.keys(PREFIXES).length + Object.keys(SUFFIXES).length + Object.keys(ROOTS).length,
  };
}
