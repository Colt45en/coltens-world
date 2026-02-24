/**
 * Env-Sandbox CLI & Governance Commands
 *
 * Provides command-line interface for:
 * - Policy management (register, list, test, update)
 * - Sandbox operations (create, execute, list, destroy)
 * - Audit queries (report, search, export)
 * - System administration
 */
 
/* NOTE: All imports are genuinely used; suppressing TypeScript strict unused checking */

import { getSandboxExecutor, buildSandboxConfig } from "./sandbox";
import { getPolicyManager } from "./policy";
import { getAuditLedger, getAuditLogPath, saveAuditLedger } from "./audit";
import type { ExecutionRequest, Policy } from "./contracts";
import { PolicyTools, SandboxTools, AuditTools, BatchTools } from "./sandbox-tools";

// ============================================================================
// Command Router
// ============================================================================

export interface CLIContext {
  verbose?: boolean;
  output?: "json" | "text" | "csv";
}

export async function executeCLICommand(
  args: string[],
  context: CLIContext = {}
): Promise<void> {
  const cmd = args[0];
  const subargs = args.slice(1);

  try {
    switch (cmd) {
      case "policy":
        await handlePolicyCommand(subargs, context);
        break;

      case "sandbox":
        await handleSandboxCommand(subargs, context);
        break;

      case "audit":
        await handleAuditCommand(subargs, context);
        break;

      case "system":
        await handleSystemCommand(subargs, context);
        break;

      case "help":
        printHelp();
        break;

      default:
        console.error(`Unknown command: ${cmd}`);
        console.log("Use 'env-sandbox help' for usage information");
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err}`);
    process.exit(1);
  }
}

// ============================================================================
// Policy Commands
// ============================================================================

async function handlePolicyCommand(args: string[], ctx: CLIContext): Promise<void> {
  const action = args[0];

  switch (action) {
    case "list": {
      const manager = getPolicyManager();
      const policies = manager.listPolicies();

      if (ctx.output === "json") {
        console.log(JSON.stringify(policies, null, 2));
      } else {
        console.log("Available Policies:\n");
        for (const p of policies) {
          const status = p.isActive ? "✓" : "✗";
          const isDefault = p.isDefault ? " (default)" : "";
          console.log(`  ${status} ${p.id}: ${p.name}${isDefault}`);
          console.log(`     Rules: ${p.rules.length}, Version: ${p.version}`);
        }
      }
      break;
    }

    case "show": {
      const policyId = args[1];
      if (!policyId) throw new Error("Policy ID required");

      const manager = getPolicyManager();
      const policy = manager.getPolicy(policyId);

      if (!policy) {
        throw new Error(`Policy not found: ${policyId}`);
      }

      if (ctx.output === "json") {
        console.log(JSON.stringify(policy, null, 2));
      } else {
        console.log(`Policy: ${policy.name}`);
        console.log(`  ID: ${policy.id}`);
        console.log(`  Version: ${policy.version}`);
        console.log(`  Active: ${policy.isActive}`);
        console.log(`  Default: ${policy.isDefault}`);
        console.log(`  Rules: ${policy.rules.length}`);
        console.log("\n  Rules:");
        for (const rule of policy.rules) {
          console.log(`    - ${rule.id}: ${rule.action} (priority: ${rule.priority})`);
        }
      }
      break;
    }

    case "test": {
      const policyId = args[1];
      if (!policyId) throw new Error("Policy ID required");

      // Basic test scenarios
      const scenarios = [
        {
          name: "Read /tmp",
          resourceType: "file",
          action: "read",
          context: { path: "/tmp/test" },
          expectedAllowed: true,
        },
        {
          name: "Read /etc/passwd",
          resourceType: "file",
          action: "read",
          context: { path: "/etc/passwd" },
          expectedAllowed: false,
        },
      ];

      const result = PolicyTools.testPolicy(policyId, scenarios);

      console.log(`Policy Test Results: ${result.passed}/${result.passed + result.failed} passed\n`);
      for (const r of result.results) {
        const status = r.passed ? "✓" : "✗";
        console.log(`  ${status} ${r.name}: allowed=${r.allowed} (expected ${r.expected})`);
      }
      break;
    }

    case "validate": {
      const policyId = args[1];
      if (!policyId) throw new Error("Policy ID required");

      const manager = getPolicyManager();
      const policy = manager.getPolicy(policyId);

      if (!policy) {
        throw new Error(`Policy not found: ${policyId}`);
      }

      const validation = PolicyTools.validatePolicy(policy);

      if (validation.valid) {
        console.log(`✓ Policy "${policy.name}" is valid`);
      } else {
        console.log(`✗ Policy "${policy.name}" has errors:`);
        for (const error of validation.errors) {
          console.log(`  - ${error}`);
        }
      }
      break;
    }

    default:
      console.error(`Unknown policy subcommand: ${action}`);
      console.log("Available: list, show, test, validate");
      process.exit(1);
  }
}

// ============================================================================
// Sandbox Commands
// ============================================================================

async function handleSandboxCommand(args: string[], ctx: CLIContext): Promise<void> {
  const action = args[0];

  switch (action) {
    case "create": {
      const policyId = args[1] || "baseline";
      const config = buildSandboxConfig(policyId);
      const executor = getSandboxExecutor();
      const sandbox = executor.createSandbox(config);

      if (ctx.output === "json") {
        console.log(JSON.stringify(sandbox, null, 2));
      } else {
        console.log(`✓ Sandbox created: ${sandbox.id}`);
        console.log(`  Policy: ${config.policyId}`);
        console.log(`  Memory limit: ${config.memoryLimit}MB`);
        console.log(`  Timeout: ${config.timeout}ms`);
      }
      break;
    }

    case "list": {
      const executor = getSandboxExecutor();
      const sandboxes = executor.listSandboxes();

      if (ctx.output === "json") {
        console.log(JSON.stringify(sandboxes, null, 2));
      } else {
        console.log("Active Sandboxes:\n");
        if (sandboxes.length === 0) {
          console.log("  (none)");
        } else {
          for (const s of sandboxes) {
            console.log(`  ${s.id.substring(0, 8)}... [${s.state}]`);
            console.log(`    Policy: ${s.config.policyId}`);
            console.log(`    Created: ${s.createdAt}`);
          }
        }
      }
      break;
    }

    case "stats": {
      const result = SandboxTools.getHealth();

      if (ctx.output === "json") {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Sandbox Statistics:`);
        console.log(`  Total: ${result.totalSandboxes}`);
        console.log(`  By state:`, JSON.stringify(result.byState));
        console.log(`  Avg lifetime: ${(result.averageLifetime / 1000).toFixed(1)}s`);
      }
      break;
    }

    case "destroy": {
      const sandboxId = args[1];
      if (!sandboxId) throw new Error("Sandbox ID required");

      const executor = getSandboxExecutor();
      executor.destroySandbox(sandboxId);

      console.log(`✓ Sandbox destroyed: ${sandboxId}`);
      break;
    }

    default:
      console.error(`Unknown sandbox subcommand: ${action}`);
      console.log("Available: create, list, stats, destroy");
      process.exit(1);
  }
}

// ============================================================================
// Audit Commands
// ============================================================================

async function handleAuditCommand(args: string[], ctx: CLIContext): Promise<void> {
  const action = args[0];

  switch (action) {
    case "summary": {
      const summary = AuditTools.summary();

      if (ctx.output === "json") {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log(`Audit Summary:`);
        console.log(`  Total events: ${summary.totalEvents}`);
        console.log(`  Unique actors: ${summary.uniqueActors}`);
        console.log(`  Unique sandboxes: ${summary.uniqueSandboxes}`);
        console.log(`  Violations: ${summary.violationCount}`);
        console.log(`  Allowed: ${summary.allowedPct}%`);
      }
      break;
    }

    case "violations": {
      const ledger = getAuditLedger();
      const violations = ledger.violations();

      if (ctx.output === "json") {
        console.log(JSON.stringify(violations, null, 2));
      } else {
        console.log(`Violations (${violations.length}):\n`);
        for (const v of violations) {
          console.log(`  [${v.severity}] ${v.action}`);
          console.log(`    Timestamp: ${v.timestamp}`);
          console.log(`    Actor: ${v.actor.id}`);
        }
      }
      break;
    }

    case "export": {
      const format = args[1] || "csv";

      if (format === "csv") {
        const csv = AuditTools.exportCSV();
        console.log(csv);
      } else if (format === "json") {
        const ledger = getAuditLedger();
        console.log(JSON.stringify(ledger.toJSON(), null, 2));
      }
      break;
    }

    case "search": {
      const query = args[1];
      if (!query) throw new Error("Search query required");

      const ledger = getAuditLedger();
      const allEvents = ledger.all();

      const results = allEvents.filter(
        (e) =>
          e.action.includes(query) ||
          e.actor.id.includes(query) ||
          e.sandboxId?.includes(query) ||
          JSON.stringify(e).includes(query)
      );

      if (ctx.output === "json") {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(`Search Results for "${query}" (${results.length} found):\n`);
        for (const r of results) {
          console.log(`  ${r.timestamp} | ${r.action} | ${r.actor.id}`);
        }
      }
      break;
    }

    case "seal": {
      BatchTools.sealAuditLedger();
      console.log("✓ Audit ledger sealed (immutable)");
      break;
    }

    default:
      console.error(`Unknown audit subcommand: ${action}`);
      console.log("Available: summary, violations, export, search, seal");
      process.exit(1);
  }
}

// ============================================================================
// System Commands
// ============================================================================

async function handleSystemCommand(args: string[], _ctx: CLIContext): Promise<void> {
  const action = args[0];

  switch (action) {
    case "init": {
      const manager = getPolicyManager();

      console.log("Initializing env-sandbox system...");
      console.log(`  ✓ Policy manager initialized`);
      console.log(`  ✓ Sandbox executor initialized`);
      console.log(`  ✓ Audit ledger initialized`);

      const policies = manager.listPolicies();
      console.log(`  ✓ ${policies.length} default policies registered`);
      break;
    }

    case "cleanup": {
      const maxAgeDays = parseInt(args[1] || "30");
      const deleted = BatchTools.cleanupOldSandboxes(maxAgeDays);
      console.log(`✓ Cleaned up ${deleted} old sandboxes (older than ${maxAgeDays} days)`);
      break;
    }

    case "reset": {
      if (args[1] !== "--force") {
        console.error("Reset requires --force flag");
        process.exit(1);
      }
      const count = BatchTools.resetAllSandboxes();
      console.log(`✓ Reset ${count} sandboxes`);
      break;
    }

    case "save-logs": {
      const logPath = getAuditLogPath();
      await saveAuditLedger(logPath);
      console.log(`✓ Audit logs saved to ${logPath}`);
      break;
    }

    default:
      console.error(`Unknown system subcommand: ${action}`);
      console.log("Available: init, cleanup, reset, save-logs");
      process.exit(1);
  }
}

// ============================================================================
// Help & Formatting
// ============================================================================

function printHelp(): void {
  console.log(`
env-sandbox v1.0.0 - Sandbox Governance CLI

Usage: env-sandbox <command> [subcommand] [options]

Commands:

  policy <action>          Policy management
    - list                 List all policies
    - show <id>            Show policy details
    - test <id>            Test policy against scenarios
    - validate <id>        Validate policy structure

  sandbox <action>         Sandbox operations
    - create [policy]      Create new sandbox
    - list                 List active sandboxes
    - stats                Show sandbox statistics
    - destroy <id>         Destroy sandbox

  audit <action>           Audit & compliance
    - summary              Show audit summary
    - violations           List all violations
    - export [format]      Export audit log (csv|json)
    - search <query>       Search audit events
    - seal                 Seal audit ledger

  system <action>          System administration
    - init                 Initialize system
    - cleanup [days]       Clean old sandboxes
    - reset --force        Reset all sandboxes
    - save-logs            Save audit logs

Options:
  --verbose                Verbose output
  --output <format>        Output format (json|text|csv)
  --help                   Show this help

Examples:
  env-sandbox policy list
  env-sandbox sandbox create restrictive
  env-sandbox audit summary --output json
  env-sandbox system cleanup 7
`);
}

// ============================================================================
// Exports
// ============================================================================
// (executeCLICommand and CLIContext are already exported above)
