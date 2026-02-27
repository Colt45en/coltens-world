/**
 * NDJSON reader: handles chunk boundaries gracefully
 *
 * Example:
 *   for await (const line of ndjsonLines(response.body)) {
 *     const event = JSON.parse(line);
 *   }
 */

export async function* ndjsonLines(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });

  let buffer = "";

  try {
    while (true) {
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
    reader.releaseLock();
  }
}
