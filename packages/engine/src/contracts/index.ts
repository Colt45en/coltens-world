// Bus envelope contracts for pipeline messaging
export * from "./busEnvelope.js";
export * from "./envelopeFactory.js";

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
