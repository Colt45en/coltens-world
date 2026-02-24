import { z } from "zod";
import { BuildEvidencePacketSchema, BuildEvidenceRequestSchema, } from "../buildEvidence";
export const EVT_BUILD_EVIDENCE_REQUEST = "build.evidence.request";
export const EVT_BUILD_EVIDENCE_GENERATED = "build.evidence.generated";
/**
 * Minimal deterministic BusEnvelope.
 * If you already have a BusEnvelope contract, keep yours and only reuse the payload schemas + event strings.
 */
export const BusEnvelopeSchema = z.object({
    v: z.literal("1"),
    id: z.string().min(8),
    ts: z.string().datetime(),
    type: z.string().min(1),
    source: z.string().min(1), // "ide-web" | "nucleus" | etc
    data: z.unknown(),
});
export const BuildEvidenceRequestMsgSchema = BusEnvelopeSchema.extend({
    type: z.literal(EVT_BUILD_EVIDENCE_REQUEST),
    data: BuildEvidenceRequestSchema,
});
export const BuildEvidenceGeneratedMsgSchema = BusEnvelopeSchema.extend({
    type: z.literal(EVT_BUILD_EVIDENCE_GENERATED),
    data: z.object({
        packet: BuildEvidencePacketSchema,
        evidencePath: z.string().min(1).optional(),
    }),
});
export const AnyBuildEvidenceBusMsgSchema = z.union([
    BuildEvidenceRequestMsgSchema,
    BuildEvidenceGeneratedMsgSchema,
]);
