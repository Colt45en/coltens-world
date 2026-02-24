import {
    BuildEvidencePacketSchema,
    type BuildEvidencePacket,
} from "@world-engine/protocol";
import { z } from "zod";

/**
 * Lexicon-facing schema layer.
 * Keep this as the single import point for lexicon consumers.
 */

export const LexiconBuildEvidenceSchema = BuildEvidencePacketSchema.extend({
    // extra lexicon fields if you want later:
    // confidence: z.number().min(0).max(1).default(1),
    // evidenceLinks: z.array(z.string()).default([]),
});

export type LexiconBuildEvidence = z.infer<typeof LexiconBuildEvidenceSchema>;

export function parseBuildEvidence(json: unknown): LexiconBuildEvidence {
    return LexiconBuildEvidenceSchema.parse(json);
}

export function isBuildEvidencePacket(x: unknown): x is BuildEvidencePacket {
    const r = BuildEvidencePacketSchema.safeParse(x);
    return r.success;
}
