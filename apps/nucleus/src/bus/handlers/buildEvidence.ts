import {
    BuildEvidenceRequestMsgSchema,
    EVT_BUILD_EVIDENCE_GENERATED,
} from "@world-engine/protocol";
import * as path from "node:path";
import { generateBuildEvidence, writeBuildEvidencePacket } from "../../services/compilerEvidence";
import { broadcastEnvelope, makeEnvelope } from "../publish";

export async function handleBuildEvidenceBusMessage(app: any, raw: unknown): Promise<boolean> {
    const parsed = BuildEvidenceRequestMsgSchema.safeParse(raw);
    if (!parsed.success) return false;

    const msg = parsed.data;
    const body = msg.data;

    const repoRootAbs = path.resolve(process.cwd());
    const buildRootAbs = path.resolve(repoRootAbs, body.buildRoot);

    const packet = await generateBuildEvidence({
        compiler: body.compiler,
        repoRoot: repoRootAbs,
        buildRoot: buildRootAbs,
        outDir: body.outDir ?? "dist",
        mode: body.mode ?? "production",
        runTypecheck: body.runTypecheck ?? true,
        runTwice: body.runTwice ?? false,
    });

    const evidenceOutAbs = path.join(
        repoRootAbs,
        ".artifacts",
        "build-evidence",
        `${packet.id}.json`
    );
    await writeBuildEvidencePacket(packet, evidenceOutAbs);

    const outEnv = makeEnvelope(EVT_BUILD_EVIDENCE_GENERATED, "nucleus", {
        packet,
        evidencePath: evidenceOutAbs,
    });

    broadcastEnvelope(app, outEnv);
    return true;
}
