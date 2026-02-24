/**
 * apps/nucleus/src/routes/http/avatars.ts
 *
 * Avatar compilation REST API endpoint.
 * Handles batch avatar DNA compilation via Nucleus.
 *
 * POST /api/avatars/compile
 * Body: { avatars: AvatarDNA[], atlasSize?: number, lodLevels?: number }
 * Response: { jobId: string, registryUrl: string, avatarCount: number }
 */

import { randomId } from "@world-engine/protocol";

export interface AvatarDNA {
  id: string;
  dna: Record<string, any>;
}

export interface AvatarCompileRequest {
  avatars: AvatarDNA[];
  atlasSize?: number; // 256, 512, 1024, 2048 (default 512)
  lodLevels?: number; // 1-4 (default 3)
}

export interface AvatarCompileResponse {
  jobId: string;
  registryUrl: string;
  avatarCount: number;
  status: "queued";
  createdAt: string;
}

/**
 * Handle POST /api/avatars/compile
 */
export async function handleAvatarCompile(pathname: string, req: any, res: any): Promise<boolean> {
  if (req.method !== "POST" || pathname !== "/api/avatars/compile") {
    return false;
  }

  try {
    // Parse request body
    let body = "";
    await new Promise<void>((resolve) => {
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        resolve();
      });
    });

    let payload: AvatarCompileRequest;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return true;
    }

    // Validate request
    if (!payload.avatars || !Array.isArray(payload.avatars)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Missing or invalid 'avatars' array" }));
      return true;
    }

    if (payload.avatars.length === 0) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Avatar array cannot be empty" }));
      return true;
    }

    // Validate atlasSize if provided
    const atlasSize = payload.atlasSize ?? 512;
    const validSizes = [256, 512, 1024, 2048];
    if (!validSizes.includes(atlasSize)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `Invalid atlasSize: ${atlasSize}. Must be one of ${validSizes.join(", ")}` }));
      return true;
    }

    // Validate lodLevels if provided
    const lodLevels = payload.lodLevels ?? 3;
    if (lodLevels < 1 || lodLevels > 4) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `Invalid lodLevels: ${lodLevels}. Must be between 1 and 4` }));
      return true;
    }

    // Create compilation job
    const jobId = randomId("avatar-compile");
    const registryUrl = `/avatar-registry/${jobId}`;

    const response: AvatarCompileResponse = {
      jobId,
      registryUrl,
      avatarCount: payload.avatars.length,
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    // TODO: In production, would:
    // 1. Queue the compilation job
    // 2. Emit avatar.compilation.started event to ledger
    // 3. Start async compilation process
    // 4. Stream results back as they complete

    console.log(`[avatars] Compilation job queued: ${jobId} (${payload.avatars.length} avatars, atlas=${atlasSize}, lod=${lodLevels})`);

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(response));

    return true;
  } catch (error: any) {
    console.error("[avatars] Compilation error:", error);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
    return true;
  }
}
