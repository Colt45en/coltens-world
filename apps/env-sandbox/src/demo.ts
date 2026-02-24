 
/**
 * Sandbox Tools Demo
 *
 * Demonstrates:
 * - Sandbox bootstrap with Recursive Creation Codex
 * - Tool registration & execution
 * - Event listening (mutations, snapshots, scheduled jobs)
 * - State diffing & snapshots
 * - Scheduler: delayed mutations
 * - JSON path introspection
 */

import {
    getByPath,
    Sandbox,
    tools,
    type SandboxEvent
} from "./sandbox-tools";

console.log("╔════════════════════════════════════════════╗");
console.log("║   Recursive Creation Codex — Sandbox Demo  ║");
console.log("╚════════════════════════════════════════════╝\n");

// Bootstrap from default Recursive Creation Codex
const sb = Sandbox.bootstrap();
console.log("✓ Sandbox bootstrapped from Recursive Creation Codex\n");

// Register built-in tools
sb.registerTool("setForceWeight", tools.setForceWeight!);
sb.registerTool("setVar", tools.setVar!);
sb.registerTool("addAgent", tools.addAgent!);
sb.registerTool("advanceEpoch", tools.advanceEpoch!);
sb.registerTool("delayedSetVar", tools.delayedSetVar!);

console.log("📦 Available tools:", sb.listTools().join(", "), "\n");

// Listen to all events
const eventLog: SandboxEvent[] = [];
sb.on((e) => {
    eventLog.push(e);
    if (e.type === "MUTATION") {
        console.log(`  🔄 ${e.path} := ${JSON.stringify(e.after)} (by: ${e.by || "system"})`);
    }
    if (e.type === "TOOL_RUN") {
        console.log(`  🛠️  tool:${e.tool} ← ${JSON.stringify(e.input)}`);
    }
    if (e.type === "TICK") {
        console.log(`  ⏱️  tick → ${e.tick}`);
    }
    if (e.type === "SCHEDULED") {
        console.log(`  📅 scheduled: ${e.label} @ tick ${e.dueTick}`);
    }
    if (e.type === "SNAPSHOT") {
        console.log(`  📸 snapshot "${e.name}" @ tick ${e.tick}`);
    }
    if (e.type === "RESTORE") {
        console.log(`  ⏮️  restored "${e.name}" @ tick ${e.tick}`);
    }
});

console.log("───────────────────────────────────────────\n");
console.log("▶️  Running tools...\n");

// 1. Set a force weight
console.log("1. setForceWeight(entropy → 0.7):");
sb.runTool("setForceWeight", { force: "entropy", weight: 0.7 }, { by: "demo", reason: "Adjust entropy" });

// 2. Set an environment var
console.log("\n2. setVar(API_URL):");
sb.runTool("setVar", { key: "API_URL", value: "http://cosmos.local:9999" }, { by: "demo" });

// 3. Add an agent
console.log("\n3. addAgent(Symbiotic Code):");
sb.runTool("addAgent", {
    name: "Symbiotic Code",
    role: "Recursive Architecture Weaver",
    model: "Emergent Agent Framework"
});

// 4. Advance to a new epoch
console.log("\n4. advanceEpoch(E1: Emergence):");
sb.runTool(
    "advanceEpoch",
    {
        label: "E1: Emergence",
        resonance: ["cascade", "coherence", "call"],
        carryTriggers: ["resource-scarcity", "observer-effect"],
        carryInfluences: ["latent-synchrony", "fate-web-entanglement"]
    },
    { by: "demo" }
);

// 5. Schedule a delayed mutation
console.log("\n5. Schedule delayed mutation:");
sb.runTool(
    "delayedSetVar",
    {
        key: "EPOCH_SEAL",
        value: "timestamp:E1-sealed",
        afterTicks: 3
    },
    { by: "demo", reason: "Seal epoch after stabilization" }
);

console.log("\n───────────────────────────────────────────\n");
console.log("▶️  Snapshot #1 (clean state):\n");

sb.snapshot("initial", "State after first mutation batch");

console.log("\n───────────────────────────────────────────\n");
console.log("▶️  Tick forward 5 times...\n");

for (let i = 0; i < 5; i++) {
    sb.tick(1);
}

console.log("\n───────────────────────────────────────────\n");
console.log("▶️  Snapshot #2 (after ticks):\n");

sb.snapshot("after-ticks", "State after 5 ticks (includes scheduled mutation)");

console.log("\n───────────────────────────────────────────\n");
console.log("▶️  Diff snapshots (initial → after-ticks):\n");

const { changedPaths } = sb.diffSnapshots("initial", "after-ticks");
console.log("Changed paths:", changedPaths.length > 0 ? changedPaths.join("\n                 ") : "(none)");

console.log("\n───────────────────────────────────────────\n");
console.log("▶️  Current state snapshot:\n");

const currentState = sb.getState();
console.log("Tick:", currentState.environment.scheduler.tick);
console.log("Force weights:");
for (const [k, v] of Object.entries(currentState.environment.forces)) {
    console.log(`  ${k}: ${(v as any).weight}`);
}
console.log("Environment vars:");
for (const [k, v] of Object.entries(currentState.environment.vars)) {
    console.log(`  ${k} = ${JSON.stringify(v)}`);
}
console.log("Agents:");
const agents = (currentState.orchestration as any)?.agents ?? [];
for (const agent of agents) {
    console.log(`  ${agent.name} (${agent.role})`);
}
console.log("Epochs:");
for (const epoch of (currentState.epochs as any) ?? []) {
    console.log(`  ${epoch.epoch} @ ${epoch.genesis_timestamp}`);
}

console.log("\n───────────────────────────────────────────\n");
console.log("▶️  List all snapshots:\n");

for (const snap of sb.listSnapshots()) {
    console.log(`  "${snap.name}" @ tick ${snap.tick} (${snap.created_at})`);
    if (snap.note) console.log(`    → ${snap.note}`);
}

console.log("\n───────────────────────────────────────────\n");
console.log("▶️  JSON path introspection:\n");

const demoPaths = [
    "$.environment.scheduler.tick",
    "$.environment.forces['entropy'].weight",
    "$.environment.vars['API_URL']",
    "$.orchestration.agents[0].name",
    "$.epochs[0].epoch"
];

for (const path of demoPaths) {
    try {
        const val = getByPath(currentState as unknown as any, path);
        console.log(`  ${path}`);
        console.log(`    → ${JSON.stringify(val)}\n`);
    } catch (err) {
        console.log(`  ${path}\n    ❌ ${err instanceof Error ? err.message : String(err)}\n`);
    }
}

console.log("───────────────────────────────────────────\n");
console.log("▶️  Event log summary:\n");

const counts = {
    MUTATION: eventLog.filter((e) => e.type === "MUTATION").length,
    TOOL_RUN: eventLog.filter((e) => e.type === "TOOL_RUN").length,
    TICK: eventLog.filter((e) => e.type === "TICK").length,
    SCHEDULED: eventLog.filter((e) => e.type === "SCHEDULED").length,
    SNAPSHOT: eventLog.filter((e) => e.type === "SNAPSHOT").length,
    RESTORE: eventLog.filter((e) => e.type === "RESTORE").length,
    ERROR: eventLog.filter((e) => e.type === "ERROR").length
};

for (const [type, count] of Object.entries(counts)) {
    if (count > 0) console.log(`  ${type}: ${count}`);
}

console.log("\n╔════════════════════════════════════════════╗");
console.log("║       Demo Complete — Codex Intact        ║");
console.log("╚════════════════════════════════════════════╝\n");
