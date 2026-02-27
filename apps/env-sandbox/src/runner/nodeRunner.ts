/**
 * Node Runner: Child Process Executor
 *
 * Stdin: JSON ExecutionRequest
 * Stdout: JSON ExecutionResponse
 * Stderr: Debug/error messages
 *
 * Spawned by SandboxExecutor with Node --allow-* flags
 * for permission-based security model.
 */

import ts from "typescript";
import type { ExecutionRequest, ExecutionResponse } from "../contracts.js";

/**
 * Transpile TypeScript to JavaScript
 */
function transpileCode(code: string, language: string): string {
  if (language === "typescript") {
    const result = ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    });
    return result.outputText;
  }
  return code;
}

/**
 * Execute user code in an isolated async function
 */
async function executeCode(
  code: string,
  language: string,
  args: Record<string, any>
): Promise<{ result: any; stdout: string; stderr: string }> {
  const transpiledCode = transpileCode(code, language);

  // Capture console output
  const capturedLog: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    capturedLog.push(args.map((a) => String(a)).join(" "));
  };
  console.error = (...args: any[]) => {
    capturedLog.push(args.map((a) => String(a)).join(" "));
  };

  try {
    // Wrap in async IIFE with args passed in scope
    const wrappedCode = `
(async () => {
  ${transpiledCode}
})()
`;

    // Execute with args in scope
    const fn = new Function("args", wrappedCode);
    const result = await fn(args);

    return {
      result,
      stdout: capturedLog.join("\n"),
      stderr: "",
    };
  } catch (error) {
    return {
      result: undefined,
      stdout: capturedLog.join("\n"),
      stderr: String(error),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

/**
 * Main: Read request from stdin, execute, write response to stdout
 */
async function main() {
  let request: ExecutionRequest;

  try {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }

    const json = Buffer.concat(chunks).toString("utf-8");
    request = JSON.parse(json);
  } catch (error) {
    const response: ExecutionResponse = {
      ok: false,
      stdout: "",
      stderr: `Failed to parse request: ${error}`,
      exitCode: 1,
      durationMs: 0,
    };
    console.log(JSON.stringify(response));
    process.exit(1);
  }

  // Execute code
  const { result, stdout, stderr } = await executeCode(
    request.code,
    request.language,
    request.args
  );

  // Build response
  const response: ExecutionResponse = {
    ok: !stderr,
    stdout,
    stderr,
    result,
    exitCode: stderr ? 1 : 0,
    durationMs: 0,
  };

  console.log(JSON.stringify(response));
}

main().catch((error) => {
  const response: ExecutionResponse = {
    ok: false,
    stdout: "",
    stderr: String(error),
    exitCode: 1,
    durationMs: 0,
  };
  console.log(JSON.stringify(response));
  process.exit(1);
});
