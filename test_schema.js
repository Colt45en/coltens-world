import { OptimizePromptV2Schema } from "./python/contracts_v1/lexicon/prompt-operators/optimizePrompt.v2.schema.js";
import fs from "node:fs";

const testData = JSON.parse(fs.readFileSync("test_optimize_v2.json", "utf8"));

console.log("Testing OPTIMIZE v2 schema validation...");
const result = OptimizePromptV2Schema.safeParse(testData);

if (result.success) {
  console.log("✅ Schema validation passed!");
  console.log("Validated data:", JSON.stringify(result.data, null, 2));
} else {
  console.log("❌ Schema validation failed:");
  result.error.issues.forEach(issue => {
    console.log(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
}
