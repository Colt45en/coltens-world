#!/usr/bin/env node

/**
 * Labs API Quick Reference
 *
 * Endpoint: http://localhost:8787
 * Contract: packages/protocol/src/contracts/labs.ts
 * Docs: LABS_INTEGRATION_GUIDE.md
 */

const examples = {
  "List all labs": {
    method: "GET",
    endpoint: "/labs/list",
    response: {
      labs: [
        "la01_regression_from_scratch",
        "la02_pca_scratch",
        "opt01_autodiff_mini",
        "opt02_logistic_from_scratch",
        "ps01_naive_bayes",
        "ps02_bootstrap_ci",
        "geo01_knn_metrics",
        "info01_softmax_ce",
      ],
    },
  },

  "Generate all labs": {
    method: "POST",
    endpoint: "/labs/generate",
    body: {
      output_dir: "labs",
      write_manifest: true,
    },
    response: {
      ok: true,
      generated: [
        {
          lab_id: "la01_regression_from_scratch",
          dir: "/absolute/path/to/labs/la01_regression_from_scratch",
          files: [
            {
              path: "la01_regression_from_scratch_starter.py",
              sha256: "abc123defg456hij789...",
              bytes: 2048,
            },
            {
              path: "la01_regression_from_scratch_test.py",
              sha256: "xyz789uvw123...",
              bytes: 1024,
            },
            {
              path: "la01_regression_from_scratch_README.md",
              sha256: "....",
              bytes: 1500,
            },
          ],
        },
        // ... 7 more labs
      ],
      catalog_path: "/absolute/path/to/labs/_catalog.json",
    },
  },

  "Generate one lab": {
    method: "POST",
    endpoint: "/labs/generate",
    body: {
      lab_id: "la01_regression_from_scratch",
      output_dir: "labs",
      write_manifest: true,
    },
    response: {
      ok: true,
      generated: [
        {
          lab_id: "la01_regression_from_scratch",
          dir: "...",
          files: ["..."],
        },
      ],
      catalog_path: "...",
    },
  },

  "Health check": {
    method: "GET",
    endpoint: "/health",
    response: {
      status: "ok",
    },
  },
};

console.log("# Labs API Quick Reference\n");
console.log("## Examples\n");

Object.entries(examples).forEach(([title, spec]) => {
  console.log(`### ${title}\n`);
  console.log(`**Method**: \`${spec.method}\``);
  console.log(`**Endpoint**: \`${spec.endpoint}\``);

  if (spec.body) {
    console.log(`\n**Request Body**:\n`);
    console.log("```json");
    console.log(JSON.stringify(spec.body, null, 2));
    console.log("```\n");
  }

  console.log(`**Response**:\n`);
  console.log("```json");
  console.log(JSON.stringify(spec.response, null, 2));
  console.log("```\n");
  console.log("---\n");
});

console.log("## Shell Examples\n");
console.log("```bash");
console.log("# List labs");
console.log("curl http://localhost:8787/labs/list\n");

console.log("# Generate all");
console.log("curl -X POST http://localhost:8787/labs/generate \\");
console.log('  -H "Content-Type: application/json" \\');
console.log("  -d '{\"output_dir\": \"labs\", \"write_manifest\": true}'\n");

console.log("# Generate one");
console.log("curl -X POST http://localhost:8787/labs/generate \\");
console.log('  -H "Content-Type: application/json" \\');
console.log(
  '  -d \'{\"lab_id\": "la01_regression_from_scratch", "output_dir": "labs"}\''
);
console.log("\n");

console.log("# Health check");
console.log("curl http://localhost:8787/health");
console.log("```\n");

console.log("## TypeScript Client (Nucleus integration)\n");
console.log("```typescript");
console.log('import { LabsGenerateRequest, LabsGenerateResponse } from "@world-engine/protocol";');
console.log("\n");
console.log("async function generateLabs(req: LabsGenerateRequest): Promise<LabsGenerateResponse> {");
console.log('  const res = await fetch("http://localhost:8787/labs/generate", {');
console.log('    method: "POST",');
console.log('    headers: { "Content-Type": "application/json" },');
console.log("    body: JSON.stringify(req),");
console.log("  });");
console.log("  return res.json();");
console.log("}");
console.log("```\n");
