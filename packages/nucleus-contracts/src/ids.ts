import { sha256Hex } from "./validate.js";

export type Brand<K, T extends string> = K & { __brand: T };

export type DocId = Brand<string, "DocId">;
export type QueryId = Brand<string, "QueryId">;
export type MemoryId = Brand<string, "MemoryId">;
export type ToolRunId = Brand<string, "ToolRunId">;

export function makeDocId(sourceType: string, sourceRef: string, textBody: string): DocId {
  return sha256Hex(`doc:${sourceType}:${sourceRef}:${textBody}`) as DocId;
}

export function makeQueryId(tsUtcIso: string, userId: string, queryText: string): QueryId {
  return sha256Hex(`q:${tsUtcIso}:${userId}:${queryText}`) as QueryId;
}

export function makeMemoryId(statement: string, createdAtUtcIso: string): MemoryId {
  return sha256Hex(`m:${createdAtUtcIso}:${statement}`) as MemoryId;
}

export function makeToolRunId(toolId: string, tsUtcIso: string, argsStableJson: string): ToolRunId {
  return sha256Hex(`tr:${toolId}:${tsUtcIso}:${argsStableJson}`) as ToolRunId;
}
