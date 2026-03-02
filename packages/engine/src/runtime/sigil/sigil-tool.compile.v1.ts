import {
  SigilCompileInputV1,
  SigilCompileOutputV1,
  SigilCompileToolExecuteV1,
  SigilCompileToolResultV1,
} from "../../contracts/sigil/sigil.compile.v1";
import { buildSigilLedgerNdjsonV1, executeSigilCompileV1 } from "./sigil-compiler.v1";

export async function handleToolExecuteSigilCompileV1(msg: unknown): Promise<SigilCompileToolResultV1> {
  const parsed = SigilCompileToolExecuteV1.parse(msg);

  const input: SigilCompileInputV1 & { request_id?: string } = {
    ...parsed.input,
    request_id: parsed.request_id,
  };

  const out: SigilCompileOutputV1 = executeSigilCompileV1(input);

  const wantLedger = parsed.input.outputs?.ledger_ndjson ?? false;
  if (wantLedger) {
    out.ledger_ndjson = await buildSigilLedgerNdjsonV1({
      program_hash: out.program_hash,
      artifact_hash: out.artifact_hash,
      request_id: parsed.request_id,
      path_count: out.artifact.paths.length,
      symmetry: out.artifact.symmetry,
    });
  }

  return {
    kind: "tool.result",
    v: 1,
    tool: "sigil.compile.v1",
    ok: true,
    output: out,
    request_id: parsed.request_id,
  };
}
