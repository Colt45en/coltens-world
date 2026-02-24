/**
 * Deterministic "asset container" format:
 * [magic 8]  "AVASSET1"
 * [u32le]    jsonByteLen
 * [bytes]    utf8 json
 * [u32le]    blobCount
 * repeat blobCount:
 *   [u32le] nameLen
 *   [bytes] name utf8
 *   [u32le] blobLen
 *   [bytes] blob
 */
import { TextEncoder } from "node:util";

export function encodeU32LE(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 255;
  b[1] = (n >>> 8) & 255;
  b[2] = (n >>> 16) & 255;
  b[3] = (n >>> 24) & 255;
  return b;
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function buildDeterministicContainer(
  json: string,
  blobs: Array<{ name: string; bytes: Uint8Array }>
): Uint8Array {
  const enc = new TextEncoder();
  const magic = enc.encode("AVASSET1"); // 8 bytes
  const jsonBytes = enc.encode(json);

  const header: Uint8Array[] = [
    magic,
    encodeU32LE(jsonBytes.length),
    jsonBytes,
    encodeU32LE(blobs.length),
  ];

  const blobParts: Uint8Array[] = [];
  for (const b of blobs) {
    const nameBytes = enc.encode(b.name);
    blobParts.push(
      encodeU32LE(nameBytes.length),
      nameBytes,
      encodeU32LE(b.bytes.length),
      b.bytes
    );
  }

  return concat([...header, ...blobParts]);
}
