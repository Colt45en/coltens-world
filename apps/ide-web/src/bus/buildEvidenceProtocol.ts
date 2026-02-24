import {
    AnyBuildEvidenceBusMsgSchema,
    EVT_BUILD_EVIDENCE_GENERATED,
    EVT_BUILD_EVIDENCE_REQUEST,
    type BuildEvidenceGeneratedMsg,
    type BuildEvidenceRequestMsg,
} from "@world-engine/protocol";
import { z } from "zod";

export {
    AnyBuildEvidenceBusMsgSchema, EVT_BUILD_EVIDENCE_GENERATED, EVT_BUILD_EVIDENCE_REQUEST
};

export type { BuildEvidenceGeneratedMsg, BuildEvidenceRequestMsg };

export const AnyInboundBusMsgSchema = AnyBuildEvidenceBusMsgSchema;
