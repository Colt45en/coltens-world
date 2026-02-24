
/**
 * @deprecated This route handler is not currently integrated into nucleus.
 * It's here for potential future use with a FastifyInstance or generic HTTP handler.
 *
 * To re-enable:
 * 1. Add 'fastify' to dependencies
 * 2. Import: import type { FastifyInstance } from "fastify";
 * 3. Replace `app: any` with `app: FastifyInstance`
 */

export async function registerBuildEvidenceRoutes(app: any) {
  // app.post("/build/evidence", async (req, reply) => {
  //   const parsed = BuildEvidenceRequestSchema.safeParse(req.body);
  //   if (!parsed.success) {
  //     return reply.status(400).send({ ok: false, error: parsed.error.format() });
  //   }

  //   const body = parsed.data;

  //   const repoRootAbs = path.resolve(process.cwd());
  //   const buildRootAbs = path.resolve(repoRootAbs, body.buildRoot);

  //   const packet = await generateBuildEvidence({
  //     compiler: body.compiler,
  //     repoRoot: repoRootAbs,
  //     buildRoot: buildRootAbs,
  //     outDir: body.outDir ?? "dist",
  //     mode: body.mode ?? "production",
  //     runTypecheck: body.runTypecheck ?? true,
  //     runTwice: body.runTwice ?? false,
  //   });

  //   // Optional: emit to disk in a known location for ingestion
  //   const evidenceOutAbs = path.join(
  //     repoRootAbs,
  //     ".artifacts",
  //     "build-evidence",
  //     `${packet.id}.json`
  //   );
  //   await writeBuildEvidencePacket(packet, evidenceOutAbs);

  //   return reply.send({ ok: true, packet, evidencePath: evidenceOutAbs });
  // });
}
