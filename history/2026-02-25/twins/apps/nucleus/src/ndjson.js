/**
 * apps/nucleus/src/ndjson.ts
 *
 * NDJSON streaming utilities for parsing newline-delimited JSON.
 * Handles packet splits and partial lines gracefully.
 */
export async function* readNdjsonStream(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                try {
                    yield JSON.parse(trimmed);
                }
                catch {
                    console.warn("[ndjson] failed to parse line:", trimmed);
                    // skip invalid lines
                }
            }
        }
        // Handle remaining buffer (final partial or complete line)
        const final = buffer.trim();
        if (final) {
            try {
                yield JSON.parse(final);
            }
            catch {
                // Ignore incomplete final line
            }
        }
    }
    finally {
        reader.releaseLock();
    }
}
