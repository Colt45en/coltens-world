/**
 * Node-only tooling utilities.
 * Re-exports browser-safe utilities from @world-engine/util.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
// Re-export browser-safe utilities
export { FileUtils, HashTools, TimeTools, PathTools } from "@world-engine/util";
/**
 * Node-only cryptographic hashing (synchronous, stronger than browser fallback).
 */
export const NodeHashTools = {
    /**
     * Synchronous SHA-256 hash using Node.js crypto.
     * Only available in Node.js environment.
     */
    sha256(content, opts) {
        const hex = createHash("sha256").update(content).digest("hex");
        const n = opts?.prefixLen ?? 0;
        return n > 0 ? hex.slice(0, n) : hex;
    },
};
/**
 * Process execution utilities (Node-only).
 */
export const ProcessTools = {
    /**
     * Run a process and capture stdout/stderr.
     * Deterministic note: process output is environmental; do NOT use this output
     * to generate deterministic IDs unless the environment is fixed.
     */
    runProcess(command, args, opts) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: opts?.cwd,
                env: opts?.env,
                stdio: "pipe",
                shell: process.platform === "win32",
            });
            let stdout = "";
            let stderr = "";
            child.stdout.setEncoding("utf8");
            child.stderr.setEncoding("utf8");
            child.stdout.on("data", (d) => (stdout += String(d)));
            child.stderr.on("data", (d) => (stderr += String(d)));
            if (opts?.stdin != null) {
                child.stdin.write(opts.stdin);
                child.stdin.end();
            }
            let timeout = null;
            if (opts?.timeoutMs && opts.timeoutMs > 0) {
                timeout = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs);
            }
            child.on("error", (err) => {
                if (timeout)
                    clearTimeout(timeout);
                reject(err);
            });
            child.on("close", (code) => {
                if (timeout)
                    clearTimeout(timeout);
                const exitCode = code ?? 0;
                resolve({ exitCode, stdout, stderr, success: exitCode === 0 });
            });
        });
    },
};
