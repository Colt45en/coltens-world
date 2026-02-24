import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === "build") continue;
      walk(p, out);
    } else {
      if (EXT.has(path.extname(ent.name))) out.push(p);
    }
  }
  return out;
}

const files = [
  ...walk(path.join(ROOT, "apps")),
  ...walk(path.join(ROOT, "packages")),
];

const offenders = [];
for (const f of files) {
  const txt = fs.readFileSync(f, "utf8");
  // Skip configuration files that legitimately contain dist patterns
  if (f.endsWith('.gitattributes') || f.endsWith('eslint.config.mjs') || f.includes('import-export-tracker.mjs')) {
    continue;
  }
  // Check for actual import statements from dist folders
  if (txt.match(/from\s+["'][^"']*dist[^"']*["']/)) {
    offenders.push(f);
  }
}

if (offenders.length) {
  console.error("❌ Dist imports detected:\n" + offenders.map(x => " - " + x).join("\n"));
  process.exit(1);
}

console.log("✅ No dist imports found.");
