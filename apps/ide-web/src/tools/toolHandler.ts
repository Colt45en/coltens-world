/**
 * apps/ide-web/src/tools/toolHandler.ts
 *
 * Handles tool.command.v1 envelopes from Nucleus.
 * Executes local tools (record_screen) and responds with tool.effect.v1.
 */

import { recordScreen, type RecordScreenArgs } from "./recordScreen";

export interface AnyEnv {
    v: 2;
    type: string;
    id?: string;
    ts?: number;
    from?: { role: string; instanceId?: string };
    sessionId?: string | undefined;
    traceId?: string | undefined;
    messageId?: string;
    payload?: any;
}

/**
 * Handle tool.command.v1 from Nucleus.
 * Executes the tool and sends tool.effect.v1 back.
 *
 * @param env - Incoming tool.command.v1 envelope
 * @param send - Function to send response envelope back to WS
 */
export async function handleToolCommand(env: AnyEnv, send: (e: AnyEnv) => void) {
    const call = env.payload;
    const toolCallId = call?.toolCallId;
    const name = call?.name as string;
    const args = call?.args ?? {};
    const traceId = env.traceId;
    const sessionId = env.sessionId;

    console.log(`[toolHandler] Executing ${name} (toolCallId=${toolCallId})`);

    try {
        if (name === "record_screen") {
            const result = await recordScreen({
                durationSeconds: args.durationSeconds,
                withAudio: args.withAudio,
                timeoutMs: args.timeoutMs,
            } as RecordScreenArgs);

            send({
                v: 2,
                type: "tool.effect.v1",
                traceId,
                sessionId,
                payload: {
                    toolCallId,
                    name,
                    status: "ok",
                    result,
                },
            });
            console.log(`[toolHandler] ${name} completed successfully`);
            return;
        }

        // Unknown tool on IDE
        throw new Error(`IDE cannot execute tool: ${name}`);
    } catch (e: any) {
        const errorMsg = String(e?.message ?? e);
        console.error(`[toolHandler] ${name} failed:`, errorMsg);

        send({
            v: 2,
            type: "tool.effect.v1",
            traceId,
            sessionId,
            payload: {
                toolCallId,
                name,
                status: "error",
                error: { message: errorMsg },
            },
        });
    }
}

/**
 * Optional: Display tool effects in the UI (e.g., query_lexicon results).
 */
export function displayToolEffect(env: AnyEnv) {
    const payload = env.payload;
    const name = payload?.name as string;
    const status = payload?.status as string;

    if (status === "ok") {
        console.log(`[toolHandler] ${name} succeeded:`, payload.result);
    } else {
        console.error(`[toolHandler] ${name} failed: ${payload?.error?.message}`);
    }
}
