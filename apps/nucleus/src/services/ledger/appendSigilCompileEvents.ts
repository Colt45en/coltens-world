import type { LedgerEntry } from "@world-engine/engine/contracts/ledger";
import type { SigilCompileFailedStageV1 } from "@world-engine/engine";
import { sha256Hex } from "@world-engine/engine";
import type { HashChainedLedger } from "@world-engine/ledger";

export interface AppendSigilCompileEventsInput {
  request_id?: string;
  program_hash: string;
  artifact_hash: string;
  path_count: number;
  symmetry: number;
  doc_id?: string;
}

export interface AppendSigilCompileFailedEventInput {
  request_id?: string;
  program_hash?: string;
  stage: SigilCompileFailedStageV1;
  error_code: "SCHEMA_ERROR" | "TOOL_FAILED" | "LEDGER_APPEND_FAILED" | string;
  error_message: string;
  doc_id?: string;
}

export async function appendSigilCompileEvents(
  ledger: HashChainedLedger,
  input: AppendSigilCompileEventsInput
): Promise<{ requested: LedgerEntry; completed: LedgerEntry }> {
  const docId = input.doc_id ?? `sigil:${input.program_hash}`;

  const requestedBody = {
    kind: "sigil.compile.requested",
    v: 1,
    tool: "sigil.compile.v1",
    request_id: input.request_id ?? null,
    program_hash: input.program_hash,
  };

  const completedBody = {
    kind: "sigil.compile.completed",
    v: 1,
    tool: "sigil.compile.v1",
    request_id: input.request_id ?? null,
    program_hash: input.program_hash,
    artifact_hash: input.artifact_hash,
    path_count: input.path_count,
    symmetry: input.symmetry,
  };

  const requested = await ledger.append({
    type: "sigil.compile.requested",
    doc_id: docId,
    payload: requestedBody,
  });

  const completed = await ledger.append({
    type: "sigil.compile.completed",
    doc_id: docId,
    artifact_id: input.artifact_hash,
    payload: completedBody,
  });

  return { requested, completed };
}

export async function appendSigilCompileFailedEvent(
  ledger: HashChainedLedger,
  input: AppendSigilCompileFailedEventInput
): Promise<LedgerEntry> {
  const docId = input.doc_id ?? `sigil:${input.program_hash ?? "unknown"}`;
  const messageHash = sha256Hex(input.error_message);

  const failedBody = {
    kind: "sigil.compile.failed",
    v: 1,
    tool: "sigil.compile.v1",
    request_id: input.request_id ?? null,
    program_hash: input.program_hash ?? null,
    doc_id: input.doc_id ?? null,
    stage: input.stage,
    error_code: input.error_code,
    error: {
      code: input.error_code,
      message: input.error_message,
      message_hash: messageHash,
    },
  };

  return await ledger.append({
    type: "sigil.compile.failed",
    doc_id: docId,
    payload: failedBody,
  });
}
