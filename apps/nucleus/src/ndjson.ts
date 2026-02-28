/**
 * NDJSON reader: handles chunk boundaries gracefully (bounded + abortable)
 *
 * - maxBufferChars prevents OOM if newline never arrives
 * - signal allows immediate cancel on disconnect/navigation
 *
 * Example:
 *   const controller = new AbortController();
 *   for await (const line of ndjsonLines(response.body, { signal: controller.signal })) {
 *     const event = JSON.parse(line);
 *   }
 */

export async function* ndjsonLines(
  stream: ReadableStream<Uint8Array>,
  opts?: { signal?: AbortSignal; maxBufferChars?: number }
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });

  const maxBufferChars = opts?.maxBufferChars ?? 2_000_000; // ~2MB chars
  let buffer = "";

  try {
    while (true) {
      // ✅ Check abort signal early
      if (opts?.signal?.aborted) {
        throw opts.signal.reason ?? new Error("aborted");
      }

      const { value, done } = await reader.read();

      if (done) {
        // flush any remaining line
        const tail = buffer.trim();
        if (tail.length > 0) {
          yield tail;
        }
        break;
      }

      // Append decoded chunk to buffer
      buffer += decoder.decode(value, { stream: true });

      // ✅ Hard cap buffer growth (prevents unbounded memory)
      if (buffer.length > maxBufferChars) {
        throw new Error(
          `NDJSON buffer exceeded ${maxBufferChars} chars (missing newlines or oversized line)`
        );
      }

      // Extract complete lines
      while (true) {
        const nlIdx = buffer.indexOf("\n");
        if (nlIdx === -1) break;

        // Yield complete line (without newline)
        const line = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 1);

        if (line.length > 0) {
          yield line;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}
