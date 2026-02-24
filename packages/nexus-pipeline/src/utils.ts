export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function hex8(u32: number) {
  return (u32 >>> 0).toString(16).padStart(8, "0");
}

export function stableId(prefix: string, seedU32: number, body: string) {
  const h = fnv1a32(`${prefix}:${seedU32}:${body}`);
  return `${prefix}_${hex8(h)}`;
}

export function tokenizeLoose(s: string): string[] {
  return (s || "")
    .split(/(\s+|[;(){}[\],.<>:=+\-*/%!&|?]+)/)
    .filter(t => t && !/^\s+$/.test(t))
    .map(t => t.trim())
    .filter(Boolean);
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union;
}
