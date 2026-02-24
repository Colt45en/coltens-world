import { z } from "zod";

/** Link in a chain showing concept → reasoning → decision → outcome → belief */
export const ChainLinkSchema = z.object({
    artifactId: z.string().min(1),
    createdAt: z.string().datetime(),

    // What happened
    concept: z.string().min(1),
    mention: z.string().min(1), // where concept appeared
    reasoningMode: z.string(),
    decision: z.string(),

    // Result
    outcome: z.string(),

    // Belief update
    beliefBefore: z.array(z.string()).default([]),
    beliefAfter: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).default(0.5)
});

export type ChainLink = z.infer<typeof ChainLinkSchema>;

export const MemoryChainSchema = z.object({
    concept: z.string().min(1),
    firstMention: z.string().datetime(),
    lastMention: z.string().datetime(),
    chainLength: z.number().int().min(1),
    links: z.array(ChainLinkSchema).min(1),

    // Summary: how belief evolved
    beliefEvolution: z.array(z.string())
});

export type MemoryChain = z.infer<typeof MemoryChainSchema>;
