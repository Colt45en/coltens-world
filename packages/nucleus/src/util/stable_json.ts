export function stableStringify(x: unknown): string {
  return JSON.stringify(x, replacer, 2);
}

function replacer(_k: string, v: unknown) {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = obj[k];
    return out;
  }
  return v;
}
