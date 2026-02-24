# Tooling CI Integration

## Overview

The tooling system provides deterministic CI gates to ensure:

- **No silent output mutations** — tools must write exactly the same files on each run
- **Tracked artifact changes** — all filesystem changes are captured with SHA256 hashes
- **Mode-based enforcement** — strict (fail CI) or warn (log violations) per tool

---

## CI Pipeline

GitHub Actions workflow runs on every push to `main`/`develop` and PR:

1. **Determinism Gate** (`tooling/test-compilers.mjs all`)
   - Runs each tool twice
   - Second run must produce **zero file changes**
   - Fails CI if any tool is non-deterministic

2. **Type Check** (`pnpm run type-check`)
   - Ensures TypeScript has no errors

3. **Build** (`pnpm run build`)
   - Full monorepo build

---

## Local Development

### Pre-commit Hook

When you commit, the determinism gate runs automatically:

```bash
# Install Husky hooks (one-time setup)
pnpm install

# Commit attempt → pre-commit hook runs
git commit -m "fix: something"

# If any tool is non-deterministic:
# ❌ Commit blocked
# → Fix tool behavior
# → Try again
```

To skip the hook (not recommended):

```bash
git commit --no-verify
```

---

## Manual Testing

### Run the Determinism Gate

```bash
node tooling/test-compilers.mjs all
node tooling/test-compilers.mjs all --verbose  # with tool output
```

### Run Individual Tool

```bash
node tooling/run.mjs codegen.gen_ts_types
node tooling/run.mjs codegen.gen_ts_types --json
node tooling/run.mjs codegen.gen_ts_types --expected-mode warn
```

### Create a New Baseline

When a tool's output changes legitimately:

```bash
node tooling/run.mjs baseline codegen.gen_ts_types --verbose
```

Check the suggested outputs:

```bash
cat tooling/baselines/codegen.gen_ts_types.baseline.json | jq .suggestedExpectedOutputs
```

Then update `tooling/tools.manifest.json`:

```json
{
  "id": "codegen.gen_ts_types",
  ...
  "expectedOutputs": [
    "packages/contracts/ts/**",
    "packages/**/dist/**"
  ]
}
```

---

## Command Reference

| Command | Purpose |
|---------|---------|
| `node tooling/run.mjs --list` | List all tools |
| `node tooling/run.mjs <toolId>` | Run single tool with determinism tracking |
| `node tooling/run.mjs all` | Run all tools |
| `node tooling/run.mjs <toolId> --json` | JSON output for parsing |
| `node tooling/run.mjs <toolId> --expected-mode warn` | Override mode (warn instead of fail) |
| `node tooling/test-compilers.mjs all` | Determinism gate (run-twice verification) |
| `node tooling/run.mjs baseline <toolId>` | Capture baseline for output validation |

---

## Architecture

### `tooling/tools.manifest.json`

Atomic registry of all tools:

```json
{
  "id": "codegen.gen_ts_types",
  "name": "Generate TS types",
  "cwd": ".",
  "command": ["node", "tooling/codegen/gen_ts_types.js"],
  "watchPaths": ["packages", "apps", "tooling"],
  "allowChanges": true,
  "expectedOutputsMode": "strict" | "warn",
  "expectedOutputs": ["packages/contracts/ts/**"]
}
```

### `tooling/run.mjs`

Universal runner:

- Snapshots files before/after execution
- Computes SHA256 hashes for content change detection
- Enforces mode-based output validation
- Writes artifacts to `tooling/dist/<toolId>/<timestamp>/`

### `tooling/test-compilers.mjs`

Determinism gate:

- Runs each tool twice sequentially
- Compares second-run diff against zero
- Fails CI if any tool is non-deterministic

### `tooling/baselines/*.baseline.json`

Captured tool outputs:

- `touchedPaths`: all files changed on baseline run
- `suggestedExpectedOutputs`: conservative glob patterns

---

## CI Failures

### "Tool is non-deterministic"

The tool produced different files on the second run.

**Fix:**

1. Run `node tooling/run.mjs <toolId> --verbose` locally
2. Check logs in `tooling/dist/<toolId>/*/logs.json`
3. Identify why tool output varies (randomness, timestamps, etc.)
4. Add determinism (seeded RNG, stable serialization, etc.)
5. Verify: `node tooling/test-compilers.mjs <toolId>`

### "Tool wrote outside expectedOutputs (mode=strict)"

Tool wrote a file that doesn't match `expectedOutputs` glob patterns.

**Fix (if output is legitimate):**

1. Run `node tooling/run.mjs baseline <toolId>`
2. Check `tooling/baselines/<toolId>.baseline.json`
3. Update `expectedOutputs` in manifest:

   ```json
   "expectedOutputs": [
     "packages/contracts/ts/**",
     "packages/**/generated/**"
   ]
   ```

4. Re-run tool to verify (exit=0)

**Fix (if output is unexpected):**

1. Investigate why tool is writing outside expected paths
2. Adjust tool logic or `watchPaths` in manifest
3. Re-baseline and update manifest

---

## Adding a New Tool

1. Create tool entry in `tooling/tools.manifest.json`:

   ```json
   {
     "id": "my.tool",
     "name": "My Tool",
     "cwd": ".",
     "command": ["node", "tooling/my/tool.js"],
     "watchPaths": ["packages", "tooling"],
     "allowChanges": true,
     "expectedOutputsMode": "warn",
     "expectedOutputs": []
   }
   ```

2. Run `node tooling/run.mjs my.tool` to verify it works

3. Run baseline when tool is stable:

   ```bash
   node tooling/run.mjs baseline my.tool --verbose
   ```

4. Update `expectedOutputs` in manifest with suggested paths

5. Switch mode to `"strict"` when ready to enforce

---

## FAQ

**Q: What if the tool has legitimate variation? (e.g., timestamps)**

A: Add determinism:

- Use seeded RNG (`crypto.getRandomValues()` with seed)
- Normalize timestamps or remove them
- Sort JSON keys before serialization
- Use stable IDs instead of random UUIDs

**Q: Can I disable the hook temporarily?**

A: Yes, use `--no-verify`, but expect CI to fail.

**Q: How do I debug a non-deterministic tool?**

A: Run with `--verbose`:

```bash
node tooling/test-compilers.mjs <toolId> --verbose
```

Check artifacts:

```bash
cat tooling/dist/<toolId>/*/manifest.json | jq .
cat tooling/dist/<toolId>/*/logs.json | jq .
```

**Q: Can I change expectedOutputsMode after strict is set?**

A: Yes, but it will allow new violations. Better to:

1. Run baseline
2. Update expectedOutputs explicitly
3. Keep mode strict

---

## Resources

- **Manifest Schema**: `tooling/tools.manifest.json`
- **Codegen Script**: `tooling/run.mjs`
- **Tests**: `tooling/test-compilers.mjs`
- **Baselines**: `tooling/baselines/`
- **Artifacts**: `tooling/dist/` (gitignored)
