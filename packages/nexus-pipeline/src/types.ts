export type Domain = "code" | "prose";
export type Objective = "readability" | "modularity" | "minimal_diff";

export type Motif = {
  id: string;              // e.g. "motif.js.map_filter"
  domain: Domain;
  token: string;
  confidence: number;      // 0..1
  complexity: number;      // 0..1
  data?: Record<string, unknown>;
};

export type Atom = {
  id: string;
  domain: Domain;
  token: string;
  kind: "atom";
  complexity: number;      // 0..1
};

export type Analysis = {
  domain: Domain;
  atoms: Atom[];
  motifs: Motif[];
};

export type TemplateBinding = {
  motifId?: string;
  args?: Record<string, unknown>;
  confidence?: number;
  atoms?: Atom[];
};

export type CandidateFeatures = {
  readability: number;     // 0..1
  modularity: number;      // 0..1
  minimal_diff: number;    // 0..1
};

export type CandidateProvenance = {
  orchestrator: "StructuralSynthesis" | "LexicalSynthesis";
  templateId: string;
  templateLabel: string;
  objective: Objective;
  density: number;
  binding: TemplateBinding;
  features: CandidateFeatures;
  transforms: string[];
  seed: string;            // hex
};

export type Candidate = {
  id: string;              // deterministic
  templateId: string;
  type: string;
  value: string;
  baseScore: number;       // 0..1
  features: CandidateFeatures;
  score: number;           // 0..1 final objective score
  provenance: CandidateProvenance;
};

export type TemplateDef = {
  id: string;
  domain: Domain;
  label: string;
  requiredMotifs: string[];
  claim: (analysis: Analysis) => TemplateBinding[];
  render: (binding: TemplateBinding, ctx: RunContext) => string;
  baseScore: (binding: TemplateBinding, ctx: RunContext) => number;
  hintFeatures?: Partial<CandidateFeatures>;
};

export type ScoringProfile = {
  objective: Objective;
  weights: { base: number; readability: number; modularity: number; minimal_diff: number };
};

export type RunContext = {
  input: string;
  domain: Domain;
  density: number;         // 0..100
  objective: Objective;
  seedU32: number;
  seedHex: string;
};
