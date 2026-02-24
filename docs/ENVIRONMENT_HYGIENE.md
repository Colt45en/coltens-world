# Environment Hygiene & Determinism Policy

## Overview

VS Code extensions inject environment variables into the terminal that can **poison determinism** in builds, tests, and artifact generation. This document establishes guardrails to keep the World Engine deterministic across all execution contexts.

---

## The Problem

When you run commands in a VS Code integrated terminal, VS Code extensions add:

### GitKraken / GitLens (`eamodio.gitlens`)

- `GK_GL_ADDR=http://127.0.0.1:64640`
- `GK_GL_PATH=...gitlens-ipc-server-*.json` (session-specific path)

### Python Debugger (`ms-python.debugpy`)

- `PYDEVD_DISABLE_FILE_VALIDATION=1`
- `VSCODE_DEBUGPY_ADAPTER_ENDPOINTS=...endpoint-*.txt` (session-specific)
- `BUNDLED_DEBUGPY_PATH=...debugpy` (varies by installation)
- Modifies `PATH` to include debugpy scripts

### GitHub Copilot (`GitHub.copilot-chat`)

- Adds paths for `copilot` / `copilot-debug` commands to `PATH`

### Python Runtime (`ms-python.python`)

- `PYTHONSTARTUP=...pythonrc.py` (can execute arbitrary code on Python startup)
- `PYTHON_BASIC_REPL=1`

## Why This Matters

These variables cause:

1. **Non-deterministic logs** — Paths with session-specific temp directories
2. **Different subprocess resolution** — `PATH` changes mean different tools get picked
3. **Unexpected Python behavior** — `PYTHONSTARTUP` can inject imports and side effects
4. **Non-reproducible artifacts** — Evidence packets, hashes, and snapshots depend on environment

**Example:** Running `pnpm build` in VS Code terminal vs. CI produces different outputs because Python sidecar starts with startup code injected.

---

## The Solution: Check, Strip, Enforce

### 1. Print Injected Vars (Visibility)

Check what's been injected into your current shell:

```bash
# Windows/PowerShell
pwsh scripts/env/print-tooling-env.ps1

# macOS/Linux
bash scripts/env/print-tooling-env.sh
```

Output shows:

- Which ext vars are active
- Entry count in PATH
- Whether your terminal is "clean" or VS Code-polluted

### 2. Run Deterministic Commands with `clean-env`

For any command that should produce **reproducible** output, wrap it:

```bash
# Windows/PowerShell
pwsh scripts/env/clean-env.ps1 pnpm build
pwsh scripts/env/clean-env.ps1 pnpm test
pwsh scripts/env/clean-env.ps1 pnpm generate:artifacts

# macOS/Linux
bash scripts/env/clean-env.sh pnpm build
bash scripts/env/clean-env.sh pnpm test
bash scripts/env/clean-env.sh pnpm generate:artifacts
```

The `clean-env` wrapper:

- ✅ Removes all VS Code extension vars
- ✅ Returns the same exit code
- ✅ Passes all arguments through
- ✅ Runs in the same shell (no subprocess overhead)

---

## How to Use

### For Development (Ad Hoc)

**Before** running a build/test command, check if you're clean:

```powershell
pwsh scripts/env/print-tooling-env.ps1
```

If vars are present and you want determinism:

```powershell
pwsh scripts/env/clean-env.ps1 pnpm build
```

### For CI/CD (Automated)

CI already has a clean environment, but **document** it:

```yaml
# .github/workflows/build.yml
- name: Check Environment
  run: bash scripts/env/print-tooling-env.sh

- name: Build
  run: bash scripts/env/clean-env.sh pnpm build
```

### For Python Sidecar (Especially Important)

The Brain sidecar is most vulnerable to `PYTHONSTARTUP`:

```bash
# Old (unsafe in VS Code terminal):
python apps/py-sidecar/app/main.py

# New (always safe):
pwsh scripts/env/clean-env.ps1 python apps/py-sidecar/app/main.py
```

Or run Python with `-E` flag to ignore environment:

```python
#!/usr/bin/env bash
export PYTHONSTARTUP=""
python -E apps/py-sidecar/app/main.py
```

---

## Don't Log These Vars into Artifacts

If you embed env vars into EvidencePackets, hashes, or reproducibility records:

### ✅ Whitelist Approach

Only capture stable vars:

```typescript
// SAFE: Whitelist known, stable values
const stableEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PNPM_VERSION: process.env.PNPM_VERSION,
  GIT_COMMIT: process.env.GIT_COMMIT,
};
```

### ✅ Redact Approach

Automatically scrub "noisy" vars:

```typescript
// SAFE: Redact any VS Code extension vars or paths w/ "temp" / "AppData"
const redactPatterns = [
  /^GK_/,
  /^VSCODE_/,
  /^PYTHONSTARTUP/,
  /^BUNDLED_DEBUGPY/,
  /Temp|AppData|workspaceStorage/,
];

const cleanEnv = {};
for (const [k, v] of Object.entries(process.env)) {
  if (redactPatterns.some((re) => re.test(k) || re.test(v ?? ""))) {
    continue; // skip
  }
  cleanEnv[k] = v;
}
```

---

## Recommended Practices

### 1. Use `clean-env` for Reproducible Builds

```bash
# ✅ Good: Always clean
pwsh scripts/env/clean-env.ps1 pnpm build

# ❌ Bad: Depends on terminal context
pnpm build
```

### 2. Document Environment Requirements

Add to your `README.md`:

```markdown
### Environment Purity

All builds should be deterministic. If running in VS Code:

\`\`\`bash
pwsh scripts/env/clean-env.ps1 pnpm build
\`\`\`

Otherwise:

\`\`\`bash
pnpm build
\`\`\`
```

### 3. Python: Disable Startup Scripts

For any Python process that should be deterministic:

```python
import os
import sys

# Ensure no startup code runs
os.environ.pop("PYTHONSTARTUP", None)

# If you need to run Python as subprocess:
subprocess.run([sys.executable, "-E", ...], env=clean_env)
```

### 4. CI Always Uses `clean-env`

```yaml
- name: Build
  run: |
    bash scripts/env/clean-env.sh pnpm build
    bash scripts/env/clean-env.sh pnpm test
    bash scripts/env/clean-env.sh pnpm run generate:artifacts
```

---

## Verification

### Running Tests with Determinism Guarantee

```bash
# Before
pnpm test  # Might pass/fail depending on terminal

# After
pwsh scripts/env/clean-env.ps1 pnpm test  # Always reproducible
```

### Checking Artifact Hashes

If you generate hashes/snapshots:

```bash
# First run (VS Code terminal):
pwsh scripts/env/clean-env.ps1 pnpm generate:artifacts
HASH_1=$(cat artifacts/checksum.txt)

# Second run (same code, different terminal):
bash scripts/env/clean-env.sh pnpm generate:artifacts
HASH_2=$(cat artifacts/checksum.txt)

# These should match:
if [[ "$HASH_1" == "$HASH_2" ]]; then
  echo "✅ Deterministic"
else
  echo "❌ Non-deterministic"
fi
```

---

## Summary: The One-Command Rule

For **any reproducible/deterministic operation**, wrap with `clean-env`:

| Command        | Original                  | Deterministic                                            |
| -------------- | ------------------------- | -------------------------------------------------------- |
| Build          | `pnpm build`              | `pwsh scripts/env/clean-env.ps1 pnpm build`              |
| Test           | `pnpm test`               | `pwsh scripts/env/clean-env.ps1 pnpm test`               |
| Artifacts      | `pnpm generate:artifacts` | `pwsh scripts/env/clean-env.ps1 pnpm generate:artifacts` |
| Python sidecar | `python main.py`          | `pwsh scripts/env/clean-env.ps1 python main.py`          |

**Bottom line:** Use `clean-env` for anything that should produce the **same output** every time.

---

## References

- VS Code Extension Environment Injection: https://code.visualstudio.com/docs/terminal/shell-integration
- Python `PYTHONSTARTUP`: https://docs.python.org/3/using/cmdline.html#envvar-PYTHONSTARTUP
- Deterministic Builds: https://wiki.debian.org/ReproducibleBuilds
