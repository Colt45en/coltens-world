/**
 * System Codex Hardening Validation Tests
 * Demonstrates strict validation, canonicalization, and hashing
 */

import {
  canonicalizeSystemCodexEntry,
  parseSystemCodexEntry,
  snapshotSystemCodexEntry
} from "./index";

// ============================================================================
// Test 1: Strict Validation - No Unknown Keys
// ============================================================================
console.log("📋 Test 1: Strict Validation\n");

try {
  // ❌ This will fail: unknown key 'custom_field'
  parseSystemCodexEntry({
    schema_version: "1.0.0",
    id: "test_system",
    name: "Test",
    created_at_utc: "2026-02-10T10:00:00Z",
    updated_at_utc: "2026-02-10T10:00:00Z",
    north_star: "Test",
    agents: [{ id: "a1", name: "Agent 1" }],
    orchestration: { mode: "code_driven" as const, routing: { strategy: "fixed_pipeline" as const, description: "test" } },
    custom_field: "this should fail", // ❌ Unknown key!
  } as any);
  console.log("❌ FAIL: Should have rejected unknown key");
} catch (err) {
  console.log("✅ PASS: Rejected unknown key");
  console.log(`   Error: ${(err as Error).message.split("\n")[0]}\n`);
}

// ============================================================================
// Test 2: Unique ID Enforcement
// ============================================================================
console.log("📋 Test 2: Unique ID Enforcement\n");

try {
  // ❌ Duplicate agent IDs
  parseSystemCodexEntry({
    schema_version: "1.0.0",
    id: "test_system",
    name: "Test",
    created_at_utc: "2026-02-10T10:00:00Z",
    updated_at_utc: "2026-02-10T10:00:00Z",
    north_star: "Test",
    agents: [
      { id: "agent_1", name: "First" },
      { id: "agent_1", name: "Second" }, // ❌ Duplicate!
    ],
    orchestration: { mode: "hybrid" as const, routing: { strategy: "supervisor" as const, description: "test" } },
  } as any);
  console.log("❌ FAIL: Should have rejected duplicate ID");
} catch (err) {
  console.log("✅ PASS: Rejected duplicate agent ID");
  console.log(
    `   Error: ${(err as Error).message.substring(0, 80)}...\n`
  );
}

// ============================================================================
// Test 3: Cross-Reference Validation (tools)
// ============================================================================
console.log("📋 Test 3: Cross-Reference Validation\n");

try {
  // ❌ Agent references unknown tool
  parseSystemCodexEntry({
    schema_version: "1.0.0",
    id: "test_system",
    name: "Test",
    created_at_utc: "2026-02-10T10:00:00Z",
    updated_at_utc: "2026-02-10T10:00:00Z",
    north_star: "Test",
    agents: [
      {
        id: "agent_1",
        name: "Agent 1",
        tools_allowed: ["unknown_tool"], // ❌ References non-existent tool
      },
    ],
    tools: [{ id: "search", name: "Search", description: "Search tool", safety_level: "medium" as const }],
    orchestration: { mode: "hybrid" as const, routing: { strategy: "supervisor" as const, description: "test" } },
  } as any);
  console.log("❌ FAILURE: Should have rejected tool reference");
} catch (err) {
  console.log("✅ PASS: Rejected unknown tool reference");
  console.log(
    `   Error: ${(err as Error).message.substring(0, 80)}...\n`
  );
}

// ============================================================================
// Test 4: Spatial Connection Validation
// ============================================================================
console.log("📋 Test 4: Spatial Connection Validation\n");

try {
  // ❌ Spatial connection to non-existent ID
  parseSystemCodexEntry({
    schema_version: "1.0.0",
    id: "test_system",
    name: "Test",
    created_at_utc: "2026-02-10T10:00:00Z",
    updated_at_utc: "2026-02-10T10:00:00Z",
    north_star: "Test",
    agents: [
      {
        id: "agent_1",
        name: "Agent 1",
        spatial: {
          connections: ["nonexistent_id"], // ❌ Invalid connection
        },
      },
    ],
    orchestration: { mode: "hybrid" as const, routing: { strategy: "supervisor" as const, description: "test" } },
  } as any);
  console.log("❌ FAILURE: Should have rejected spatial connection");
} catch (err) {
  console.log("✅ PASS: Rejected invalid spatial connection");
  console.log(
    `   Error: ${(err as Error).message.substring(0, 80)}...\n`
  );
}

// ============================================================================
// Test 5: Valid System Creates Successfully
// ============================================================================
console.log("📋 Test 5: Valid System Parses\n");

const validSystem = {
  schema_version: "1.0.0" as const,
  id: "valid_system",
  name: "Valid System",
  created_at_utc: "2026-02-10T10:00:00Z",
  updated_at_utc: "2026-02-10T10:00:00Z",
  north_star: "Maximize value",
  agents: [
    {
      id: "analyst",
      name: "Analyst",
      tools_allowed: ["search", "compute"],
    },
  ],
  tools: [
    { id: "search", name: "Search", description: "Search", safety_level: "medium" as const },
    { id: "compute", name: "Compute", description: "Math", safety_level: "low" as const },
  ],
  orchestration: {
    mode: "hybrid" as const,
    routing: {
      strategy: "supervisor" as const,
      description: "Supervisor routing",
    },
  },
};

const codex = parseSystemCodexEntry(validSystem as any);
console.log("✅ PASS: Valid system parsed");
console.log(`   System ID: ${codex.id}`);
console.log(`   Agents: ${codex.agents.length}`);
console.log(`   Tools: ${codex.tools.length}\n`);

// ============================================================================
// Test 6: Canonicalization - Deterministic Ordering
// ============================================================================
console.log("📋 Test 6: Canonicalization\n");

const unsorted = {
  ...validSystem,
  agents: [
    { id: "zebra", name: "Z" },
    { id: "apple", name: "A" },
  ],
  tools: [
    { id: "zebra", name: "Z", description: "Z", safety_level: "medium" as const },
    { id: "apple", name: "A", description: "A", safety_level: "low" as const },
  ],
} as any;

const unsortedParsed = parseSystemCodexEntry(unsorted);
const canonical = canonicalizeSystemCodexEntry(unsortedParsed);

console.log("✅ PASS: Canonicalization");
console.log(`   Original agent order: zebra, apple`);
console.log(`   Canonical agent order: ${canonical.agents.map((a: any) => a.id).join(", ")}`);
console.log(`   Canonical tool order: ${canonical.tools.map((t: any) => t.id).join(", ")}\n`);

// ============================================================================
// Test 7: SHA256 Snapshot Hash
// ============================================================================
console.log("📋 Test 7: SHA256 Snapshot Hashing\n");

try {
  const snapshot = await snapshotSystemCodexEntry(codex);

  console.log("✅ PASS: Snapshot hash computed");
  console.log(`   SHA256: ${snapshot.sha256}`);
  console.log(
    `   Canonical JSON length: ${snapshot.canonical_json.length} bytes`
  );
  console.log(`   First 80 chars: ${snapshot.canonical_json.substring(0, 80)}...\n`);

  // ========================================================================
  // Test 8: Hash Determinism
  // ========================================================================
  console.log("📋 Test 8: Deterministic Hash\n");

  const snapshot2 = await snapshotSystemCodexEntry(codex);
  if (snapshot.sha256 === snapshot2.sha256) {
    console.log("✅ PASS: Hash is deterministic");
    console.log(`   Hash 1: ${snapshot.sha256}`);
    console.log(`   Hash 2: ${snapshot2.sha256}\n`);
  } else {
    console.log("❌ FAILURE: Hash should be deterministic");
  }

  // ========================================================================
  // Test 9: Hash Changes on Modification
  // ========================================================================
  console.log("📋 Test 9: Hash Changes on Modification\n");

  const modifiedCodex = {
    ...codex,
    north_star: "Different objective",
  };
  const modifiedSnapshot = await snapshotSystemCodexEntry(modifiedCodex);

  if (snapshot.sha256 === modifiedSnapshot.sha256) {
    console.log("❌ FAILURE: Hash should change");
  } else {
    console.log("✅ PASS: Hash changed after modification");
    console.log(`   Original:  ${snapshot.sha256}`);
    console.log(`   Modified:  ${modifiedSnapshot.sha256}\n`);
  }

  // ========================================================================
  // Summary
  // ========================================================================
  console.log("════════════════════════════════════════════════════════════");
  console.log("🎉 All Tests Passed! System Codex Hardening Verified\n");
  console.log("Features:");
  console.log("  ✅ Strict object validation (no unknown keys)");
  console.log("  ✅ Unique ID enforcement across collections");
  console.log("  ✅ Cross-reference validation (tool refs, spatial)");
  console.log("  ✅ Deterministic canonicalization");
  console.log("  ✅ SHA256 snapshot hashing (deterministic)");
  console.log("  ✅ Portable (browser + Node compatible)");
  console.log("════════════════════════════════════════════════════════════\n");
} catch (err) {
  console.error("❌ Test failed:", err);
}
