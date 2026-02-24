import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..")

const openapi_json = path.join(root, "packages/contracts/openapi/openapi.json");
const output_ts = path.join(root, "packages/contracts/ts/types.ts");

console.log(`📋 Generating TS types from OpenAPI...`);
console.log(`   Input: ${openapi_json}`);
console.log(`   Output: ${output_ts}`);

// Stub mode: if input doesn't exist, skip generation
if (!fs.existsSync(openapi_json)) {
  console.log(`⚠️  STUB: OpenAPI spec not found, skipping generation`);
  console.log(`   (Run: pnpm contracts:export when ready)\n`);
  process.exit(0);
}

// If output already exists and is recent, skip
if (fs.existsSync(output_ts)) {
  const inputMtime = fs.statSync(openapi_json).mtimeMs;
  const outputMtime = fs.statSync(output_ts).mtimeMs;

  if (outputMtime >= inputMtime) {
    console.log(`✅ TS types already up-to-date (${output_ts})`);
    process.exit(0);
  }
}

// Try to generate if openapi-typescript is available, but don't fail if not
try {
  const { execSync } = await import("node:child_process");
  execSync(`openapi-typescript "${openapi_json}" -o "${output_ts}"`, {
    stdio: "inherit",
    cwd: root,
  });
  console.log(`✅ Generated ${output_ts}`);
} catch (err) {
  // openapi-typescript might not be installed; that's OK in stub mode
  console.log(`⚠️  STUB: openapi-typescript not available, skipping generation`);
  process.exit(0);
}
