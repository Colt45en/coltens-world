import {
    IdeFsReadRequestSchema,
    type IdeFsReadResponse,
} from "@world-engine/protocol";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Safety: only allow reading from docs/ and .brain/ directories
 */
function isAllowedPath(p: string): boolean {
    const normalized = p.replace(/\\/g, "/");
    return normalized.startsWith("docs/") || normalized.startsWith(".brain/");
}

export async function handleIdeFsRead(raw: unknown): Promise<IdeFsReadResponse> {
    const parsed = IdeFsReadRequestSchema.safeParse(raw);
    if (!parsed.success) {
        return {
            ok: false,
            path: (raw as any)?.payload?.path ?? "unknown",
            error: `Invalid request: ${parsed.error.message}`,
        };
    }

    const msg = parsed.data;
    const payload = msg.payload;
    const reqPath = payload.path;

    if (!isAllowedPath(reqPath)) {
        return {
            ok: false,
            path: reqPath,
            error: `Path not allowed. Only docs/ and .brain/ are readable.`,
        };
    }

    const abs = path.resolve(process.cwd(), reqPath);

    try {
        const buf = await fs.readFile(abs);
        if (buf.byteLength > payload.maxBytes) {
            return {
                ok: false,
                path: reqPath,
                error: `File too large (${buf.byteLength} > ${payload.maxBytes} bytes)`,
            };
        }

        return {
            ok: true,
            path: reqPath,
            content: buf.toString("utf8"),
        };
    } catch (e: any) {
        return {
            ok: false,
            path: reqPath,
            error: e?.message ?? "read failed",
        };
    }
}
