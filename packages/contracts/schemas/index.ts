// Bus envelope contracts for pipeline messaging
export * from "./busEnvelope.js";
export * from "./envelopeFactory.js";

// Physics world contract (platform-agnostic)
export * as physics from "@world-engine/physics-contract";

// MultiGPU work partitioning contracts
export * from "./multigpu/index.js";

// Lexicon contracts for neural vocabulary
export {
	LexiconEntryFileSchema,
	LexiconEntrySchema,
	LexiconFileHeaderSchema,
	parseLexiconEntryFile,
	type LexiconEntry,
	type LexiconEntryFile,
	SemVerSchema,
	StableIdSchema as LexiconStableIdSchema,
	PromptOperatorRegistry,
} from "./lexicon/index.js";
