# CI Integration Quick Start

## What is this?

A **determinism gate** in CI that ensures tools produce identical output on every run. This catches:

- ❌ Non-deterministic randomness (UUIDs, timestamps)
- ❌ File ordering variations
- ❌ Silent mutations (tools modifying files unexpectedly)

When any tool fails the gate, **CI blocks the PR**.

---

## For Developers

### Before You Commit

The pre-commit hook runs automatically:

```bash
git commit -m "fix: something"

# Pre-commit hook runs:
# node tooling/test-compilers.mjs all
```

If it fails, the hook blocks the commit and shows which tool is non-deterministic.

### Fix Non-Determinism

1. Run the tool with verbose output:

   ```bash
   pnpm tooling:determinism:verbose
   ```

2. Check the logs:

   ```bash
   cat tooling/dist/<toolId>/*/logs.json | jq .
   ```

3. Fix the tool's logic (remove randomness, sort outputs, etc.)

4. Test again:

   ```bash
   pnpm tooling:determinism
   ```

5. Commit succeeds ✅

---

## For CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. **Determinism Gate** (blocks PR if fails)

   ```bash
   node tooling/test-compilers.mjs all
   ```

2. **Type Check** (blocks PR if fails)

   ```bash
   pnpm type-check
   ```

3. **Build** (blocks PR if fails)

   ```bash
   pnpm build
   ```

All three must pass to merge.

---

## Quick Commands

```bash
# List all tools
pnpm tooling:list

# Run determinism check (local)
pnpm tooling:determinism

# Run with verbose output
pnpm tooling:determinism:verbose

# Capture baseline for a tool
pnpm tooling:baseline codegen.gen_ts_types --verbose

# Run all tools once (with tracking)
pnpm tooling:run
```

---

## Update Expected Outputs

When a tool's output changes legitimately (new files):

1. Run baseline:

   ```bash
   pnpm tooling:baseline codegen.gen_ts_types --verbose
   ```

2. Check suggested paths:

   ```bash
   cat tooling/baselines/codegen.gen_ts_types.baseline.json | jq .suggestedExpectedOutputs
   ```

3. Update `tooling/tools.manifest.json`:

   ```json
   {
     "id": "codegen.gen_ts_types",
     ...
     "expectedOutputs": [
       "packages/contracts/ts/**"
     ]
   }
   ```

4. Verify:

   ```bash
   pnpm tooling:determinism
   ```

---

## Troubleshooting

### "Tool is non-deterministic"

The tool produced different output on the second run.

**Cause:** The tool's logic includes randomness (UUIDs, `Math.random()`, timestamps, etc.)

**Fix:**

- Use seeded RNG
- Remove timestamps
- Sort output before serialization
- Use stable IDs

### "Tool wrote outside expectedOutputs"

The tool created files not matching the expected patterns.

**Fix:**

- Run baseline and update manifest, OR
- Investigate why tool is writing to unexpected paths

### Pre-commit hook not running?

Install Husky:

```bash
pnpm install
```

Then:

```bash
npx husky install
```

---

## See Also

- **Full Documentation**: [docs/TOOLING_CI.md](../docs/TOOLING_CI.md)
- **Tool Registry**: [tooling/tools.manifest.json](../tooling/tools.manifest.json)
- **CI Workflow**: [.github/workflows/ci.yml](../.github/workflows/ci.yml)
