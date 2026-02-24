import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "packages/engine/src/contracts");
const OUT_TS = path.join(ROOT, "packages/contracts/schemas");
const OUT_PY = path.join(ROOT, "python/contracts_v1"); // choose a real target folder

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, ent.name);
    const b = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

fs.rmSync(OUT_TS, { recursive: true, force: true });
copyDir(SRC, OUT_TS);

fs.rmSync(OUT_PY, { recursive: true, force: true });
copyDir(SRC, OUT_PY);

console.log("✅ Synced contracts:");
console.log(" -", OUT_TS);
console.log(" -", OUT_PY);
