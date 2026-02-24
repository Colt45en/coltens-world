/**
 * Icon Generator - Browser-compatible utilities
 * Port of the Node CLI script for client-side use
 */

export interface PostMetadata {
  title: string;
  date: string | null;
  slug: string;
  seed: string;
}

/**
 * Simple slugify function
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

/**
 * Extract posts from "Icon for..." formatted text
 */
export function extractPosts(raw: string): PostMetadata[] {
  const lines = raw
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const month =
    "(January|February|March|April|May|June|July|August|September|October|November|December)";
  const dateRe = new RegExp(`\\b${month}\\s+([0-9]{1,2}),\\s+([0-9]{4})\\b`);

  const posts: PostMetadata[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Primary anchor
    if (!line || !line.startsWith("Icon for ")) continue;

    const titleFromIcon = line.slice("Icon for ".length).trim();

    // Search next ~6 lines for a date and a usable title line
    let foundDate: string | null = null;
    let foundTitle = titleFromIcon;

    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const currentLine = lines[j];
      if (!currentLine) continue;

      const m = currentLine.match(dateRe);
      if (m && m[0]) {
        foundDate = `${m[1]} ${m[2]}, ${m[3]}`; // e.g. "January 30, 2026"
        // If that line begins with a title-ish prefix, prefer it
        const parts = currentLine.split(m[0]);
        const beforeDate = parts[0]?.trim() || "";
        if (beforeDate.length >= 4) foundTitle = beforeDate;
        break;
      }
      // If we see another "Icon for", stop (next entry)
      if (currentLine.startsWith("Icon for ")) break;
    }

    const canonicalTitle = foundTitle.replace(/\s+/g, " ").trim();
    const slug = slugify(canonicalTitle || titleFromIcon);
    const seed = foundDate ? `${canonicalTitle} | ${foundDate}` : canonicalTitle;

    posts.push({
      title: canonicalTitle || titleFromIcon,
      date: foundDate,
      slug,
      seed,
    });
  }

  // De-dupe by slug, keep first occurrence
  const seen = new Set<string>();
  const out: PostMetadata[] = [];
  for (const p of posts) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push(p);
  }

  return out;
}

/**
 * Simple 32-bit hash from string
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) >>> 0;
}

/**
 * Mulberry32 PRNG (deterministic)
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface Palette {
  bg: string;
  bg2: string;
  ink: string;
  a1: string;
  a2: string;
  a3: string;
}

function pickPalette(rng: () => number): Palette {
  // HSL palette derived from hash — keeps things cohesive
  const baseHue = Math.floor(rng() * 360);
  const accentHue = (baseHue + 50 + Math.floor(rng() * 120)) % 360;

  const bg = `hsl(${baseHue} 35% ${clamp(18 + rng() * 10, 18, 30)}%)`;
  const bg2 = `hsl(${(baseHue + 18) % 360} 40% ${clamp(
    16 + rng() * 12,
    16,
    32
  )}%)`;
  const ink = `hsl(${(baseHue + 180) % 360} 30% 92%)`;
  const a1 = `hsl(${accentHue} 70% 60%)`;
  const a2 = `hsl(${(accentHue + 25) % 360} 70% 55%)`;
  const a3 = `hsl(${(accentHue + 210) % 360} 60% 62%)`;

  return { bg, bg2, ink, a1, a2, a3 };
}

function svgEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface IconOptions {
  seed: string;
  title: string;
  size?: number;
}

/**
 * Generate deterministic SVG icon from seed
 */
export function generateIconSvg(options: IconOptions): string {
  const { seed, title, size = 96 } = options;

  const seedU32 = simpleHash(seed);
  const rng = mulberry32(seedU32);
  const pal = pickPalette(rng);

  const s = size;
  const r = Math.round(s * 0.22); // corner radius
  const pad = Math.round(s * 0.12);
  const grid = 5;
  const cell = (s - pad * 2) / grid;

  // grid fill pattern mirrored horizontally
  const fills: string[] = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < Math.ceil(grid / 2); x++) {
      const roll = rng();
      const on = roll > 0.44; // density
      if (!on) continue;

      const mx = grid - 1 - x;

      // choose a shape style
      const k = Math.floor(rng() * 3);
      const colorPick = [pal.ink, pal.a1, pal.a2, pal.a3][
        Math.floor(rng() * 4)
      ];
      const cx = pad + x * cell;
      const cy = pad + y * cell;

      const inset = cell * 0.16;
      const x0 = cx + inset;
      const y0 = cy + inset;
      const w = cell - inset * 2;
      const h = cell - inset * 2;

      const makeRect = (rx: number) =>
        `<rect x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${w.toFixed(
          2
        )}" height="${h.toFixed(2)}" rx="${rx.toFixed(
          2
        )}" fill="${colorPick}" opacity="0.92"/>`;

      const makeDiamond = () => {
        const px = cx + cell / 2;
        const py = cy + cell / 2;
        const d = cell * 0.36;
        return `<path d="M ${px.toFixed(2)} ${(py - d).toFixed(
          2
        )} L ${(px + d).toFixed(2)} ${py.toFixed(2)} L ${px.toFixed(
          2
        )} ${(py + d).toFixed(2)} L ${(px - d).toFixed(2)} ${py.toFixed(
          2
        )} Z" fill="${colorPick}" opacity="0.92"/>`;
      };

      const makeCircle = () => {
        const px = cx + cell / 2;
        const py = cy + cell / 2;
        const rad = cell * 0.28;
        return `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(
          2
        )}" r="${rad.toFixed(2)}" fill="${colorPick}" opacity="0.92"/>`;
      };

      let shape: string;
      if (k === 0) shape = makeRect(cell * 0.22);
      else if (k === 1) shape = makeCircle();
      else shape = makeDiamond();

      // original cell
      fills.push(shape);

      // mirrored cell
      if (mx !== x) {
        const dx = (mx - x) * cell;
        const mirrored = shape
          .replace(/x="([0-9.]+)"/g, (_m, val) =>
            `x="${(Number(val) + dx).toFixed(2)}"`
          )
          .replace(/cx="([0-9.]+)"/g, (_m, val) =>
            `cx="${(Number(val) + dx).toFixed(2)}"`
          )
          .replace(/M ([0-9.]+) ([0-9.]+)/g, (_m, vx, vy) =>
            `M ${(Number(vx) + dx).toFixed(2)} ${vy}`
          )
          .replace(/L ([0-9.]+) ([0-9.]+)/g, (_m, vx, vy) =>
            `L ${(Number(vx) + dx).toFixed(2)} ${vy}`
          );
        fills.push(mirrored);
      }
    }
  }

  // overlay ring
  const ringCx = s * (0.42 + rng() * 0.16);
  const ringCy = s * (0.42 + rng() * 0.16);
  const ringR = s * (0.22 + rng() * 0.09);
  const ringW = clamp(s * (0.04 + rng() * 0.02), 3, 9);
  const ringColor = rng() > 0.5 ? pal.a1 : pal.a3;

  // overlay triangle/chevron
  const triSize = s * (0.16 + rng() * 0.1);
  const triX = s * (0.6 + rng() * 0.18);
  const triY = s * (0.2 + rng() * 0.18);
  const triColor = rng() > 0.5 ? pal.a2 : pal.ink;

  // subtle grain dots
  const grainCount = Math.floor(28 + rng() * 28);
  const grains: string[] = [];
  for (let i = 0; i < grainCount; i++) {
    const gx = rng() * s;
    const gy = rng() * s;
    const gr = 0.6 + rng() * 0.9;
    const go = 0.1 + rng() * 0.16;
    grains.push(
      `<circle cx="${gx.toFixed(2)}" cy="${gy.toFixed(2)}" r="${gr.toFixed(
        2
      )}" fill="white" opacity="${go.toFixed(3)}"/>`
    );
  }

  const safeTitle = svgEscape(title);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" role="img" aria-label="${safeTitle}">
  <title>${safeTitle}</title>
  <defs>
    <linearGradient id="bg-${seedU32}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${pal.bg}"/>
      <stop offset="1" stop-color="${pal.bg2}"/>
    </linearGradient>
    <filter id="soft-${seedU32}" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="${(s * 0.006).toFixed(2)}"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${s}" height="${s}" rx="${r}" fill="url(#bg-${seedU32})"/>

  <g>${grains.join("")}</g>

  <g>
    ${fills.join("\n    ")}
  </g>

  <circle cx="${ringCx.toFixed(2)}" cy="${ringCy.toFixed(
    2
  )}" r="${ringR.toFixed(2)}" fill="none" stroke="${ringColor}" stroke-width="${ringW.toFixed(
    2
  )}" opacity="0.70"/>

  <path d="M ${triX.toFixed(2)} ${triY.toFixed(2)}
           L ${(triX + triSize).toFixed(2)} ${(triY + triSize * 0.18).toFixed(
    2
  )}
           L ${(triX + triSize * 0.18).toFixed(2)} ${(triY + triSize).toFixed(
    2
  )}
           Z"
        fill="${triColor}" opacity="0.78" filter="url(#soft-${seedU32})"/>

  <rect x="${(s * 0.02).toFixed(2)}" y="${(s * 0.02).toFixed(2)}"
        width="${(s * 0.96).toFixed(2)}" height="${(s * 0.96).toFixed(2)}"
        rx="${(r * 0.86).toFixed(2)}" fill="none"
        stroke="rgba(255,255,255,0.12)" stroke-width="${Math.max(
          1,
          Math.round(s * 0.02)
        )}"/>
</svg>`;
}
