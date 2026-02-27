// Bus envelope contracts for pipeline messaging
export * from "./busEnvelope";
export * from "./envelopeFactory";

// Provenance spine contracts (ledger, artifacts, tool calls)
export * from "./artifacts";
export * from "./json";
export * from "./ledger";
export * from "./tool_call";


// Physics world contract (platform-agnostic)
// TODO: Import from @world-engine/physics-contract when available
export * as physics from "./physics/index.js";

// MultiGPU work partitioning contracts
export * from "./multigpu/index.js";

// Lexicon contracts for neural vocabulary
export {
    LexiconEntryFileSchema,
    LexiconEntrySchema,
    LexiconFileHeaderSchema, StableIdSchema as LexiconStableIdSchema,
    PromptOperatorRegistry, SemVerSchema, parseLexiconEntryFile,
    type LexiconEntry,
    type LexiconEntryFile
} from "./lexicon/index.js";

// Formatting kernel contracts (deterministic text normalization + sort keys)
export * from "./formatting.js";
