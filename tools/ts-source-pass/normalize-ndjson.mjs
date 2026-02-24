#!/usr/bin/env node
/**
 * NDJSON normalizer (stabilizes merges by sorting + de-duping by key).
 * Usage:
 *   node tools/ts-source-pass/normalize-ndjson.mjs knowledge.ndjson --key id --write
 *
 * Default behavior prints normalized content to stdout.
 */
import fs from "node:fs";

const args = process.argv.slice(2);
const file = args[0];
const getArg = (k, d=null) => {
  const i = args.indexOf(k);
  if (i === -1) return d;
  return args[i+1] ?? d;
};
const keyField = getArg("--key", "id");
const write = args.includes("--write");

if (!file) {
  console.error("Usage: normalize-ndjson.mjs <file> [--key id] [--write]");
  process.exit(2);
}

const text = fs.readFileSync(file, "utf8");
const lines = text.split(/\r?\n/).filter(Boolean);

const parsed = [];
for (const ln of lines){
  try { parsed.push(JSON.parse(ln)); }
  catch { /* keep raw */ parsed.push({ __raw: ln }); }
}

const withKey = parsed.map((o, idx)=>{
  const k = (o && typeof o === "object" && keyField in o) ? String(o[keyField]) : `__raw:${idx}`;
  return { k, o };
});

// stable sort by key
withKey.sort((a,b)=> a.k.localeCompare(b.k));

const dedup = [];
let last = null;
for (const it of withKey){
  if (it.k === last) continue;
  last = it.k;
  dedup.push(it.o);
}

const out = dedup.map(o => (o && typeof o === "object" && "__raw" in o) ? o.__raw : JSON.stringify(o)).join("\n") + "\n";
if (write) fs.writeFileSync(file, out, "utf8");
else process.stdout.write(out);
