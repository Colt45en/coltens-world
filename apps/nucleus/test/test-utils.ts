/**
 * Test utilities for nucleus integration tests
 */

import { Server } from "node:http";

/**
 * Creates a test HTTP server for testing routes
 */
export function createTestServer(handler: (req: any, res: any) => void): Server {
  return require("node:http").createServer(handler);
}

/**
 * Wait for a duration in milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock WebSocket message validation
 */
export function createMockMessage(data: unknown): string {
  return JSON.stringify(data);
}

/**
 * Parse NDJSON stream
 */
export async function* parseNDJSON(text: string) {
  for (const line of text.split("\n")) {
    if (line.trim()) {
      yield JSON.parse(line);
    }
  }
}
