#!/usr/bin/env node
/**
 * Generate TypeScript types from OpenAPI spec.
 *
 * Requires: openapi-typescript (npm/pnpm)
 *
 * Usage:
 *   node tooling/codegen/gen_ts_types.js
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const openapi_json = path.join(root, "packages/contracts/openapi/openapi.json");
const output_ts = path.join(root, "packages/contracts/ts/types.ts");

console.log(`📋 Generating TS types from OpenAPI...`);
console.log(`   Input: ${openapi_json}`);
console.log(`   Output: ${output_ts}`);

try {
  execSync(`openapi-typescript "${openapi_json}" -o "${output_ts}"`, {
    stdio: "inherit",
    cwd: root,
  });
  console.log(`✅ Generated ${output_ts}`);
} catch (e) {
  console.error(`❌ Failed to generate types. Ensure 'openapi-typescript' is installed:`);
  console.error(`   pnpm add -D openapi-typescript`);
  process.exit(1);
}
