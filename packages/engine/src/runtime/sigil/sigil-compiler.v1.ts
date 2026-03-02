import type {
    SigilArtifactV1,
    SigilCompileInputV1,
    SigilCompileOutputV1,
    SigilPathV1,
    SigilProgramV1,
    SigilRecipeV1,
} from "../../contracts/sigil/sigil.compile.v1";

export function stableStringify(x: unknown): string {
  if (x === null) return "null";
  const t = typeof x;

  if (t === "number") {
    if (!Number.isFinite(x)) return "null";
    return String(x);
  }
  if (t === "boolean") return x ? "true" : "false";
  if (t === "string") return JSON.stringify(x);

  if (Array.isArray(x)) {
    return `[${x.map((v) => stableStringify(v)).join(",")}]`;
  }

  if (t === "object") {
    const o = x as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }

  return "null";
}

export function sha256Hex(s: string): string {
  const bytes = new TextEncoder().encode(s);

  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  let h3 = 0x811c9dc5;
  let h4 = 0x811c9dc5;

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((b + i) & 0xff), 0x01000193) >>> 0;
    h3 = Math.imul(h3 ^ ((b * 3 + i) & 0xff), 0x01000193) >>> 0;
    h4 = Math.imul(h4 ^ ((b * 7 + i) & 0xff), 0x01000193) >>> 0;
  }

  const mix = (x: number): string => {
    const y = (x ^ (x >>> 16)) >>> 0;
    return y.toString(16).padStart(8, "0");
  };

  return `${mix(h1)}${mix(h2)}${mix(h3)}${mix(h4)}${mix(h1 ^ h3)}${mix(h2 ^ h4)}${mix(h1 ^ h2)}${mix(h3 ^ h4)}`;
}

function nfcLower(s: string): string {
  return (s ?? "").normalize("NFC").toLowerCase();
}

function isHex(s: string): boolean {
  return /^[0-9a-f]+$/i.test(s);
}

function hexToU32Seed(hex: string): number {
  return (parseInt(hex.slice(0, 8), 16) >>> 0) >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function q(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function bigrams(word: string): string[] {
  const w = word.replace(/[^a-z0-9]/g, "");
  if (w.length === 0) return [];
  if (w.length === 1) return [w + w];
  const out: string[] = [];
  for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
  return out;
}

function bigramCode(bg: string): number {
  const a = bg.charCodeAt(0) || 0;
  const b = bg.charCodeAt(1) || 0;
  return ((a * 131) ^ (b * 313) ^ (a << 7) ^ (b << 3)) >>> 0;
}

function polar(cx: number, cy: number, r: number, theta: number) {
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

function fmt3(n: number): string {
  return Number(n).toFixed(3);
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const tau = Math.PI * 2;
  const da = ((a1 - a0) % tau + tau) % tau;
  const large = da > Math.PI ? 1 : 0;
  const sweep = 1;
  return `M ${fmt3(p0.x)} ${fmt3(p0.y)} A ${fmt3(r)} ${fmt3(r)} 0 ${large} ${sweep} ${fmt3(p1.x)} ${fmt3(p1.y)}`;
}

function linePath(x0: number, y0: number, x1: number, y1: number): string {
  return `M ${fmt3(x0)} ${fmt3(y0)} L ${fmt3(x1)} ${fmt3(y1)}`;
}

export function normalizeProgramV1(program: SigilProgramV1): SigilProgramV1 {
  const normWords = (xs: string[]) =>
    xs.map((s) => nfcLower(s).replace(/\s+/g, " ").trim()).filter((s) => s.length > 0);

  const fg = program.style.fg.toLowerCase();

  return {
    kind: "sigil.program",
    v: 1,
    roles: {
      prefixes: normWords(program.roles.prefixes),
      roots: normWords(program.roles.roots),
      suffixes: normWords(program.roles.suffixes),
    },
    ops: {
      link: !!program.ops.link,
      flow: !!program.ops.flow,
      fuse: !!program.ops.fuse,
    },
    style: {
      size: program.style.size | 0,
      pad: program.style.pad | 0,
      stroke: Number(program.style.stroke),
      fg,
    },
    symmetry: program.symmetry ?? null,
    seed_hex: program.seed_hex ? program.seed_hex.toLowerCase() : null,
  };
}

export function compileSigilProgramV1(programInput: SigilProgramV1): {
  program_hash: string;
  artifact: SigilArtifactV1;
  artifact_hash: string;
} {
  const program = normalizeProgramV1(programInput);

  const programCanonical = stableStringify(program);
  const program_hash = sha256Hex(programCanonical);

  const seedHex = program.seed_hex && isHex(program.seed_hex) ? program.seed_hex : program_hash;
  const seed_u32 = hexToU32Seed(seedHex);
  const rng = mulberry32(seed_u32);
  void rng;

  const size = program.style.size;
  const pad = program.style.pad;
  const stroke = program.style.stroke;

  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - pad;

  const rOuter = R * 0.88;
  const rMid = R * 0.62;
  const rInner = R * 0.36;

  const symmetryAuto = 6 + (hexToU32Seed(program_hash.slice(8)) % 7);
  const symmetry = program.symmetry ?? symmetryAuto;

  const baseRot = (hexToU32Seed(program_hash.slice(16)) % 360) * (Math.PI / 180);

  function strokesForSegment(seg: string, ringR: number, weight: number): SigilPathV1[] {
    const bgs = bigrams(seg);
    const paths: SigilPathV1[] = [];

    for (let i = 0; i < bgs.length; i++) {
      const bg = bgs[i];
      if (!bg) continue;
      const code = (bigramCode(bg) ^ hexToU32Seed(program_hash.slice(24))) >>> 0;

      const spoke = code % symmetry;
      const spoke2 = (spoke + 1 + ((code >>> 5) % Math.max(1, symmetry - 1))) % symmetry;

      const t0 = baseRot + (2 * Math.PI * spoke) / symmetry;
      const t1 = baseRot + (2 * Math.PI * spoke2) / symmetry;

      const jitter = ((code >>> 9) % 1000) / 1000;
      const span = (0.25 + 0.55 * jitter) * (Math.PI / symmetry);

      paths.push({
        type: 1,
        ring: q(ringR, 6),
        angle: q(t0, 6),
        d: arcPath(cx, cy, ringR, t0 - span, t0 + span),
        stroke_width: q(stroke * weight, 6),
        opacity: q(0.95, 6),
      });

      const pA = polar(cx, cy, ringR, t0);
      const pB = polar(cx, cy, ringR * (0.78 + 0.18 * (((code >>> 13) % 1000) / 1000)), t1);
      paths.push({
        type: 2,
        ring: q(ringR, 6),
        angle: q(t0, 6),
        d: linePath(pA.x, pA.y, pB.x, pB.y),
        stroke_width: q(stroke * (0.65 * weight), 6),
        opacity: q(0.85, 6),
      });

      const tickLen = ringR * (0.05 + 0.06 * (((code >>> 17) % 1000) / 1000));
      const pT0 = polar(cx, cy, ringR - tickLen, t0);
      const pT1 = polar(cx, cy, ringR + tickLen * 0.35, t0);
      paths.push({
        type: 3,
        ring: q(ringR, 6),
        angle: q(t0, 6),
        d: linePath(pT0.x, pT0.y, pT1.x, pT1.y),
        stroke_width: q(stroke * (0.5 * weight), 6),
        opacity: q(0.95, 6),
      });
    }

    return paths;
  }

  const paths: SigilPathV1[] = [];

  for (const p of program.roles.prefixes) paths.push(...strokesForSegment(p, rOuter, 1.15));
  for (const r of program.roles.roots) paths.push(...strokesForSegment(r, rMid, 1.0));
  for (const s of program.roles.suffixes) paths.push(...strokesForSegment(s, rInner, 0.95));

  if (program.ops.link || program.ops.flow) {
    const count = symmetry + 2;
    for (let i = 0; i < count; i++) {
      const th = baseRot + (2 * Math.PI * i) / count;
      const p0 = polar(cx, cy, rOuter, th);
      const p1 = polar(
        cx,
        cy,
        rInner,
        th + (program.ops.link ? Math.PI / count : Math.PI / (2 * count))
      );

      paths.push({
        type: 4,
        ring: q(rOuter, 6),
        angle: q(th, 6),
        d: linePath(p0.x, p0.y, p1.x, p1.y),
        stroke_width: q(stroke * (program.ops.link ? 0.5 : 0.4), 6),
        opacity: q(program.ops.link ? 0.75 : 0.6, 6),
      });
    }
  }

  const coreR = R * 0.12;
  const coreSteps = symmetry * 2;
  for (let i = 0; i < coreSteps; i++) {
    const th0 = baseRot + (2 * Math.PI * i) / coreSteps;
    const th1 = th0 + (2 * Math.PI) / (coreSteps * 2);
    paths.push({
      type: 5,
      ring: 0,
      angle: q(th0, 6),
      d: arcPath(cx, cy, coreR, th0, th1),
      stroke_width: q(stroke * 0.75, 6),
      opacity: 1,
    });
  }

  paths.sort((a, b) => {
    if (a.type !== b.type) return a.type - b.type;
    if (Math.abs((b.ring ?? 0) - (a.ring ?? 0)) > 0.000001) return (b.ring ?? 0) - (a.ring ?? 0);
    return (a.angle ?? 0) - (b.angle ?? 0);
  });

  const artifact: SigilArtifactV1 = {
    kind: "sigil.artifact",
    v: 1,
    program_hash,
    seed_u32,
    symmetry,
    base_rot_rad: q(baseRot, 9),
    rings: {
      outer: q(rOuter, 6),
      mid: q(rMid, 6),
      inner: q(rInner, 6),
    },
    paths,
    program,
  };

  const artifact_hash = sha256Hex(stableStringify(artifact));
  return { program_hash, artifact, artifact_hash };
}

export function renderSigilSvgV1(artifact: SigilArtifactV1): string {
  const size = artifact.program.style.size;
  const fg = artifact.program.style.fg;

  const meta = stableStringify({
    generator: "sigil.compile.v1",
    program_hash: artifact.program_hash,
    program: artifact.program,
  });

  const paths = artifact.paths
    .map((p) => {
      const sw = q(p.stroke_width, 6);
      const op = q(p.opacity, 6);
      return `<path d="${p.d}" stroke-width="${sw}" opacity="${op}" />`;
    })
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<metadata>${meta}</metadata>`,
    `<g fill="none" stroke="${fg}" stroke-linecap="round" stroke-linejoin="round">`,
    paths,
    `</g>`,
    `</svg>`,
  ].join("");
}

export async function buildSigilLedgerNdjsonV1(args: {
  program_hash: string;
  artifact_hash: string;
  request_id?: string;
  path_count: number;
  symmetry: number;
}): Promise<string> {
  const events = [
    {
      kind: "sigil.compile.requested",
      v: 1,
      body: {
        tool: "sigil.compile.v1",
        request_id: args.request_id ?? null,
        program_hash: args.program_hash,
      },
    },
    {
      kind: "sigil.compile.completed",
      v: 1,
      body: {
        tool: "sigil.compile.v1",
        request_id: args.request_id ?? null,
        program_hash: args.program_hash,
        artifact_hash: args.artifact_hash,
        path_count: args.path_count,
        symmetry: args.symmetry,
      },
    },
  ] as const;

  let prev = "0".repeat(64);
  const lines: string[] = [];

  for (let i = 0; i < events.length; i++) {
    const entry = { i, prev, ...events[i] };
    const hash = sha256Hex(stableStringify(entry));
    const full = { ...entry, hash };
    lines.push(stableStringify(full));
    prev = hash;
  }

  return lines.join("\n") + "\n";
}

export function executeSigilCompileV1(input: SigilCompileInputV1 & { request_id?: string }): SigilCompileOutputV1 {
  const { program, outputs } = input;
  const want = {
    svg: outputs?.svg ?? true,
    recipe: outputs?.recipe ?? false,
    ledger_ndjson: outputs?.ledger_ndjson ?? false,
  };

  const { program_hash, artifact, artifact_hash } = compileSigilProgramV1(program);

  const out: SigilCompileOutputV1 = {
    program_hash,
    artifact_hash,
    artifact,
  };

  if (want.svg) out.svg = renderSigilSvgV1(artifact);

  if (want.recipe) {
    const recipe: SigilRecipeV1 = {
      kind: "sigil.recipe",
      v: 1,
      program_hash,
      artifact_hash,
      program: artifact.program,
    };
    out.recipe = recipe;
  }

  if (!want.ledger_ndjson) {
    return out;
  }

  return out;
}
