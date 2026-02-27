#!/usr/bin/env node

/**
 * CLI: Sandbox Governance & Control
 *
 * Simple CLI without external dependencies
 *
 * Commands:
 *  - policy list       : List all policies
 *  - sandbox create    : Create a new sandbox
 *  - sandbox list      : List all sandboxes
 *  - audit summary     : Print audit summary
 *  - audit export-csv  : Export audit log as CSV
 */

import {
    AuditTools,
    PolicyManager,
    SandboxExecutor
} from "./index.js";

const args = process.argv.slice(2);
const [command, subcommand] = args;

async function main() {
  try {
    if (!command) {
      console.log(`
env-sandbox CLI

Commands:
  policy list         - List all policies
  sandbox create      - Create a new sandbox
  sandbox list        - List all sandboxes
  audit summary       - Print audit summary
  audit export-csv    - Export audit log as CSV
  audit verify        - Verify audit ledger integrity
`);
      return;
    }

    if (command === "policy" && subcommand === "list") {
      const pm = new PolicyManager();
      const policies = pm.listPolicies();
      console.log(JSON.stringify(policies, null, 2));
      return;
    }

    if (command === "sandbox" && subcommand === "create") {
      const executor = new SandboxExecutor();
      const policyId = args[2] || "baseline";
      const pm = new PolicyManager();

      const policy = pm.getPolicy(policyId);
      if (!policy) {
        console.error(`Unknown policy: ${policyId}`);
        process.exit(1);
      }

      const sandbox = executor.createSandbox({
        policyId,
        capabilities: ["read:fs", "write:fs"],
        memoryLimit: 512,
        diskLimit: 100,
        cpuLimit: 50,
        timeout: 30000,
        networkAllowed: false,
      });

      console.log(JSON.stringify(sandbox, null, 2));
      return;
    }

    if (command === "sandbox" && subcommand === "list") {
      const executor = new SandboxExecutor();
      const sandboxes = executor.listSandboxes();
      console.log(JSON.stringify(sandboxes, null, 2));
      return;
    }

    if (command === "audit" && subcommand === "summary") {
      const auditTools = new AuditTools();
      const summary = auditTools.summary();
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    if (command === "audit" && subcommand === "export-csv") {
      const auditTools = new AuditTools();
      const csv = auditTools.exportAsCSV();
      console.log(csv);
      return;
    }

    if (command === "audit" && subcommand === "verify") {
      const auditTools = new AuditTools();
      const result = auditTools.verifyIntegrity();
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.error(`Unknown command: ${command} ${subcommand}`);
    process.exit(1);
  } catch (error) {
    console.error("CLI Error:", error);
    process.exit(1);
  }
}

main();
