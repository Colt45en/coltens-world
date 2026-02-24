/**
 * apps/nucleus/src/tool/types.ts
 *
 * Type definitions for tool command/effect protocol
 */

export interface AnyEnv {
    v: 2;
    type: string;
    id?: string;
    ts?: number;
    from?: { role: string; instanceId?: string };
    sessionId?: string;
    traceId?: string;
    messageId?: string;
    payload?: any;
}

export interface ToolCall {
    toolCallId: string;
    name: "record_screen" | "query_lexicon" | string; // Allow any string for extensibility
    args: Record<string, any>;
}

export type ToolCommandEnv = AnyEnv & {
    type: "tool.command.v1";
    payload: ToolCall;
};

export type ToolEffectEnv = AnyEnv & {
    type: "tool.effect.v1";
    payload: {
        toolCallId: string;
        name: string; // Allow any tool name
        status: "ok" | "error";
        result?: any;
        error?: { message: string };
    };
};
