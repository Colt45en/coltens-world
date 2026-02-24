#!/usr/bin/env node
/**
 * Deterministic Post Icon Generator (no deps)
 * - Reads your "Icon for ..." index text (stdin or --input)
 * - Extracts title + date
 * - Generates a stable, symmetric SVG icon per post
 * - Writes icons + an index.json manifest
 *
 * Node: 18+
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function usage(exitCode = 0) {
  const msg = `
generate-post-icons.mjs

USAGE
  node scripts/generate-post-icons.mjs --input posts.txt --out public/post-icons --size 96
  node scripts/generate-post-icons.mjs --from-stdin --out public/post-icons --size 96

OPTIONS
  --input <file>       Read raw text from a file
  --from-stdin         Read raw text from stdin
  --out <dir>          Output directory (default: public/post-icons)
  --size <n>           SVG width/height in px (default: 96)
  --check              CI mode: fail if output differs from what's on disk
  --quiet              Less logging

EXAMPLES (Windows)
  type posts.txt | node scripts/generate-post-icons.mjs --from-stdin --out public\\post-icons
`;
  process.stderr.write(msg + "\n");
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    input: null,
    fromStdin: false,
    outDir: "public/post-icons",
    size: 96,
    check: false,
    quiet: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") args.input = argv[++i] ?? null;
    else if (a === "--from-stdin") args.fromStdin = true;
    else if (a === "--out") args.outDir = argv[++i] ?? args.outDir;
    else if (a === "--size") args.size = Number(argv[++i] ?? args.size);
    else if (a === "--check") args.check = true;
    else if (a === "--quiet") args.quiet = true;
    else if (a === "--help" || a === "-h") usage(0);
    else {
      process.stderr.write(`Unknown arg: ${a}\n`);
      usage(2);
    }
  }

  if (!args.input && !args.fromStdin) {
    // default behavior: if stdin is piped, read it; else require input
    args.fromStdin = !process.stdin.isTTY;
  }

  if (!Number.isFinite(args.size) || args.size < 32 || args.size > 512) {
    throw new Error("--size must be a number between 32 and 512");
  }

  return args;
}

function readAllStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function slugify(s) {
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
 * Parse entries from text like:
 *   Icon for The Becoming: ...
 *   The Becoming: ... January 30, 2026
 *
 * We treat "Icon for ..." lines as anchors, then look forward for a date.
 */
function extractPosts(raw) {
  const lines = raw
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const month =
    "(January|February|March|April|May|June|July|August|September|October|November|December)";
  const dateRe = new RegExp(`\\b${month}\\s+([0-9]{1,2}),\\s+([0-9]{4})\\b`);

  const posts = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Primary anchor
    if (!line.startsWith("Icon for ")) continue;

    const titleFromIcon = line.slice("Icon for ".length).trim();

    // Search next ~6 lines for a date and a usable title line.
    let foundDate = null;
    let foundTitle = titleFromIcon;

    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const m = lines[j].match(dateRe);
      if (m) {
        foundDate = `${m[1]} ${m[2]}, ${m[3]}`; // e.g. "January 30, 2026"
        // If that line begins with a title-ish prefix, prefer it.
        // Example: "The Becoming: ... January 30, 2026"
        const beforeDate = lines[j].split(m[0])[0].trim();
        if (beforeDate.length >= 4) foundTitle = beforeDate;
        break;
      }
      // If we see another "Icon for", stop (next entry)
      if (lines[j].startsWith("Icon for ")) break;
    }

    // If no date found, we still emit an entry (date = null) using the title anchor.
    const canonicalTitle = foundTitle.replace(/\s+/g, " ").trim();
    const slug = slugify(canonicalTitle || titleFromIcon);
    const seed = foundDate ? `${canonicalTitle} | ${foundDate}` : canonicalTitle;

    posts.push({
      title: canonicalTitle || titleFromIcon,
      date: foundDate, // may be null
      slug,
      seed,
    });
  }

  // De-dupe by slug, keep first occurrence
  const seen = new Set();
  const out = [];
  for (const p of posts) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push(p);
  }
  return out;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function mulberry32(seedU32) {
  let a = seedU32 >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function u32FromHash(seed) {
  const h = crypto.createHash("sha256").update(seed, "utf8").digest();
  // first 4 bytes -> u32
  return (
    (h[0] << 24) |
    (h[1] << 16) |
    (h[2] << 8) |
    h[3]
  ) >>> 0;
}

function pickPalette(rng) {
  // HSL palette derived from hash — keeps things cohesive
  const baseHue = Math.floor(rng() * 360);
  const accentHue = (baseHue + 50 + Math.floor(rng() * 120)) % 360;

  const bg = `hsl(${baseHue} 35% ${clamp(18 + rng() * 10, 18, 30)}%)`;
  const bg2 = `hsl(${(baseHue + 18) % 360} 40% ${clamp(16 + rng() * 12, 16, 32)}%)`;
  const ink = `hsl(${(baseHue + 180) % 360} 30% 92%)`;
  const a1 = `hsl(${accentHue} 70% 60%)`;
  const a2 = `hsl(${(accentHue + 25) % 360} 70% 55%)`;
  const a3 = `hsl(${(accentHue + 210) % 360} 60% 62%)`;

  return { bg, bg2, ink, a1, a2, a3 };
}

function svgEscape(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Icon design:
 * - Rounded square background with subtle gradient + grain dots
 * - Symmetric 5x5 grid "glyph" (mirrored horizontally)
 * - One overlay ring + one overlay triangle/diamond for distinct silhouette
 */
function makeIconSvg({ seed, title, size }) {
  const seedU32 = u32FromHash(seed);
  const rng = mulberry32(seedU32);
  const pal = pickPalette(rng);

  const s = size;
  const r = Math.round(s * 0.22); // corner radius
  const pad = Math.round(s * 0.12);
  const grid = 5;
  const cell = (s - pad * 2) / grid;

  // grid fill pattern mirrored horizontally
  const fills = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < Math.ceil(grid / 2); x++) {
      const roll = rng();
      const on = roll > 0.44; // density
      if (!on) continue;

      const mx = grid - 1 - x;

      // choose a shape style
      const k = Math.floor(rng() * 3);
      const colorPick = [pal.ink, pal.a1, pal.a2, pal.a3][Math.floor(rng() * 4)];
      const cx = pad + x * cell;
      const cy = pad + y * cell;

      const inset = cell * 0.16;
      const x0 = cx + inset;
      const y0 = cy + inset;
      const w = cell - inset * 2;
      const h = cell - inset * 2;

      const makeRect = (rx) =>
        `<rect x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${w.toFixed(
          2
        )}" height="${h.toFixed(2)}" rx="${rx.toFixed(2)}" fill="${colorPick}" opacity="0.92"/>`;

      const makeDiamond = () => {
        const px = cx + cell / 2;
        const py = cy + cell / 2;
        const d = cell * 0.36;
        return `<path d="M ${px.toFixed(2)} ${(py - d).toFixed(2)} L ${(px + d).toFixed(
          2
        )} ${py.toFixed(2)} L ${px.toFixed(2)} ${(py + d).toFixed(2)} L ${(px - d).toFixed(
          2
        )} ${py.toFixed(2)} Z" fill="${colorPick}" opacity="0.92"/>`;
      };

      const makeCircle = () => {
        const px = cx + cell / 2;
        const py = cy + cell / 2;
        const rad = cell * 0.28;
        return `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${rad.toFixed(
          2
        )}" fill="${colorPick}" opacity="0.92"/>`;
      };

      let shape;
      if (k === 0) shape = makeRect(cell * 0.22);
      else if (k === 1) shape = makeCircle();
      else shape = makeDiamond();

      // original + mirrored cell
      fills.push({ x, y, shape });
      if (mx !== x) {
        // regenerate mirrored shape at mirrored x with same geometry but shifted
        const dx = (mx - x) * cell;
        const mirrored = shape.replaceAll(
          /x="([0-9.]+)"/g,
          (_m, val) => `x="${(Number(val) + dx).toFixed(2)}"`
        )
        .replaceAll(
          /cx="([0-9.]+)"/g,
          (_m, val) => `cx="${(Number(val) + dx).toFixed(2)}"`
        )
        .replaceAll(
          /M ([0-9.]+) ([0-9.]+)/g,
          (_m, vx, vy) => `M ${(Number(vx) + dx).toFixed(2)} ${vy}`
        )
        .replaceAll(
          /L ([0-9.]+) ([0-9.]+)/g,
          (_m, vx, vy) => `L ${(Number(vx) + dx).toFixed(2)} ${vy}`
        );
        fills.push({ x: mx, y, shape: mirrored });
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
  const triSize = s * (0.16 + rng() * 0.10);
  const triX = s * (0.60 + rng() * 0.18);
  const triY = s * (0.20 + rng() * 0.18);
  const triColor = rng() > 0.5 ? pal.a2 : pal.ink;

  // subtle grain dots
  const grainCount = Math.floor(28 + rng() * 28);
  const grains = [];
  for (let i = 0; i < grainCount; i++) {
    const gx = rng() * s;
    const gy = rng() * s;
    const gr = 0.6 + rng() * 0.9;
    const go = 0.10 + rng() * 0.16;
    grains.push(
      `<circle cx="${gx.toFixed(2)}" cy="${gy.toFixed(2)}" r="${gr.toFixed(
        2
      )}" fill="white" opacity="${go.toFixed(3)}"/>`
    );
  }

  const safeTitle = svgEscape(title);

  // NOTE: SVG is self-contained; no external CSS needed
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" role="img" aria-label="${safeTitle}">
  <title>${safeTitle}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${pal.bg}"/>
      <stop offset="1" stop-color="${pal.bg2}"/>
    </linearGradient>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="${(s * 0.006).toFixed(2)}"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${s}" height="${s}" rx="${r}" fill="url(#bg)"/>

  <!-- grain -->
  <g>${grains.join("")}</g>

  <!-- glyph -->
  <g>
    ${fills.map((f) => f.shape).join("\n    ")}
  </g>

  <!-- overlay ring -->
  <circle cx="${ringCx.toFixed(2)}" cy="${ringCy.toFixed(
    2
  )}" r="${ringR.toFixed(2)}" fill="none" stroke="${ringColor}" stroke-width="${ringW.toFixed(
    2
  )}" opacity="0.70"/>

  <!-- overlay triangle -->
  <path d="M ${triX.toFixed(2)} ${triY.toFixed(2)}
           L ${(triX + triSize).toFixed(2)} ${(triY + triSize * 0.18).toFixed(2)}
           L ${(triX + triSize * 0.18).toFixed(2)} ${(triY + triSize).toFixed(2)}
           Z"
        fill="${triColor}" opacity="0.78" filter="url(#soft)"/>

  <!-- rounded mask edge polish -->
  <rect x="${(s * 0.02).toFixed(2)}" y="${(s * 0.02).toFixed(2)}"
        width="${(s * 0.96).toFixed(2)}" height="${(s * 0.96).toFixed(2)}"
        rx="${(r * 0.86).toFixed(2)}" fill="none"
        stroke="rgba(255,255,255,0.12)" stroke-width="${Math.max(1, Math.round(s * 0.02))}"/>
</svg>
`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listFilesRecursive(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function sha256File(fp) {
  const buf = fs.readFileSync(fp);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function writeIfChanged(fp, content) {
  const prev = fs.existsSync(fp) ? fs.readFileSync(fp, "utf8") : null;
  if (prev === content) return false;
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, content, "utf8");
  return true;
}

async function main() {
  const args = parseArgs(process.argv);

  let raw = "";
  if (args.input) {
    raw = fs.readFileSync(args.input, "utf8");
  } else if (args.fromStdin) {
    raw = await readAllStdin();
  } else {
    usage(2);
  }

  const posts = extractPosts(raw);
  if (posts.length === 0) {
    throw new Error(
      `No posts found. Expected lines starting with "Icon for ". (Did the input format change?)`
    );
  }

  const outDir = path.resolve(args.outDir);
  ensureDir(outDir);

  // generate icons
  const manifest = [];
  let changedCount = 0;

  for (const p of posts) {
    const fileName = `${p.slug || "untitled"}.svg`;
    const fp = path.join(outDir, fileName);

    const svg = makeIconSvg({
      seed: p.seed,
      title: p.title,
      size: args.size,
    });

    const changed = writeIfChanged(fp, svg);
    if (changed) changedCount++;

    manifest.push({
      title: p.title,
      date: p.date,
      slug: p.slug,
      icon: path.posix.join(path.basename(outDir), fileName),
      seed: p.seed,
    });
  }

  // write manifest (stable ordering)
  manifest.sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.slug.localeCompare(b.slug));
  const manifestPath = path.join(outDir, "index.json");
  const manifestJson = JSON.stringify(
    { generatedAt: new Date().toISOString(), size: args.size, count: manifest.length, posts: manifest },
    null,
    2
  );
  const manifestChanged = writeIfChanged(manifestPath, manifestJson);
  if (manifestChanged) changedCount++;

  // CI check mode: fail if anything would change
  if (args.check) {
    // Re-hash on disk
    const files = listFilesRecursive(outDir).filter((f) => f.endsWith(".svg") || f.endsWith("index.json"));
    const hashes = files.map((f) => ({ f: path.relative(outDir, f), h: sha256File(f) }));
    // If we wrote changes above, that's already a fail condition for check mode:
    if (changedCount > 0) {
      process.stderr.write(
        `Icon output is NOT up to date (${changedCount} file(s) differ). Re-run generation and commit results.\n`
      );
      process.exit(1);
    }
    if (!args.quiet) {
      process.stdout.write(`OK: ${hashes.length} files verified in ${outDir}\n`);
    }
    process.exit(0);
  }

  if (!args.quiet) {
    process.stdout.write(
      `Generated ${posts.length} icon(s) at ${outDir} (${changedCount} file(s) updated)\n`
    );
    process.stdout.write(`Wrote manifest: ${manifestPath}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + "\n");
  process.exit(1);
});
