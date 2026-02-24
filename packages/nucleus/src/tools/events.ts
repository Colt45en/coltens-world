export type ToolEvent =
  | { type: "tool.started"; tool_id: string; at_utc: string }
  | { type: "tool.finished"; tool_id: string; at_utc: string; status: "succeeded" | "failed"; exit_code: number | null; duration_ms: number };

export interface ToolEventSink {
  emit(ev: ToolEvent): void;
}

export class NoopToolEventSink implements ToolEventSink {
  emit(_ev: ToolEvent): void {}
}
