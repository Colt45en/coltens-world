export type Role = "ide" | "preview" | "nucleus" | "python";

export type EnvelopeAuth =
  | { kind: "session"; token: string }
  | { kind: "hmac"; token: string; sig: string };

export type EnvelopeTrace = {
  parentId?: string;
  spanId?: string;
};

/**
 * BusEnvelope v2 — secure by default
 *
 * Backward-compatible: nonce/auth/caps/trace are optional in type-level,
 * but the server will REQUIRE nonce+auth for non-handshake messages.
 *
 * Security:
 *   - nonce: per-message random string (replay protection)
 *   - auth: session token or HMAC signature (authentication)
 *   - caps: client may echo, server ignores (derives from session)
 *   - trace: optional tracing metadata
 */
export type BusEnvelope<TType extends string, TPayload> = {
  v: number;
  id: string;
  type: TType;
  ts: number;
  from: {
    role: Role;
    instanceId: string;
  };
  sessionId: string;
  payload: TPayload;

  // v2 fields (optional in type, required by server after handshake):
  nonce?: string | undefined;
  auth?: EnvelopeAuth | undefined;
  caps?: string[] | undefined;
  trace?: EnvelopeTrace | undefined;
};

export function nowMs(): number {
  return Date.now();
}

export function randomId(prefix: string): string {
  const r = Math.random().toString(16).slice(2);
  return `${prefix}_${Date.now().toString(16)}_${r}`;
}
