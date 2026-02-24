import crypto from "node:crypto";

export function sha256HexBytes(bytes: Uint8Array): string {
  const h = crypto.createHash("sha256");
  h.update(bytes);
  return h.digest("hex");
}

export function sha256HexString(s: string): string {
  const h = crypto.createHash("sha256");
  h.update(s, "utf8");
  return h.digest("hex");
}
