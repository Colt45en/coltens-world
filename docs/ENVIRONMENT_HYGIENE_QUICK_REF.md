# Environment Hygiene — Quick Reference Card

## What's the Problem?

VS Code extensions inject **7 environment variables** that make builds non-deterministic:

- `GK_GL_*` — GitKraken integration
- `PYDEVD_*` — Python debugger
- `BUNDLED_DEBUGPY_PATH` — Python debugger path
- `VSCODE_*` — VS Code paths (session-specific)
- `PYTHONSTARTUP` — ⚠️ **Injects code into Python processes**
- `PYTHON_BASIC_REPL` — Python REPL flag

**Result:** Same code produces different builds/hashes depending on terminal context.

---

## Three Critical Commands

### 1️⃣ Check What's Injected

```bash
pnpm env:check
# or
pwsh scripts/env/print-tooling-env.ps1
```

Shows all injected vars and whether your terminal is "clean" or "polluted".

### 2️⃣ Build Deterministically

```bash
pwsh scripts/env/clean-env.ps1 pnpm build
pwsh scripts/env/clean-env.ps1 pnpm test
pwsh scripts/env/clean-env.ps1 python app/main.py
```

Or use the shortcut:

```bash
pnpm build:deterministic
```

### 3️⃣ Read the Policy

```bash
cat docs/ENVIRONMENT_HYGIENE.md    # Complete guide
cat scripts/env/README.md          # Quick start
```

---

## One-Command Rule

**For EVERY reproducible operation:**

```bash
# ❌ Don't
pnpm build

# ✅ Do
pwsh scripts/env/clean-env.ps1 pnpm build
```

That's it. Always use `clean-env` for:

- Builds
- Tests
- Artifact generation
- Python subprocesses
- Hashing/checksums

---

## Common Commands

```bash
# Check environment
pnpm env:check

# Build cleanly
pnpm build:deterministic

# Test cleanly
pwsh scripts/env/clean-env.ps1 pnpm test

# Python sidecar cleanly
pwsh scripts/env/clean-env.ps1 python app/py-sidecar/app/main.py

# Verify determinism (run twice, compare hashes)
pwsh scripts/env/clean-env.ps1 pnpm generate:artifacts
```

---

## The PYTHONSTARTUP Danger ⚠️

This env var can execute **arbitrary code** when Python starts:

```
PYTHONSTARTUP=/path/to/startup/script.py
```

If your Python process runs in VS Code, it will:

- Execute the startup script
- Import modules
- Change behavior
- Produce different output

**Fix:**

```bash
pwsh scripts/env/clean-env.ps1 python main.py # Strips PYTHONSTARTUP
```

Or disable it explicitly:

```bash
$env:PYTHONSTARTUP=""
python main.py
```

---

## For CI/CD (GitHub Actions, etc.)

```yaml
- name: Build
  run: bash scripts/env/clean-env.sh pnpm build

- name: Test
  run: bash scripts/env/clean-env.sh pnpm test
```

This ensures **local builds match CI builds exactly**.

---

## Status

✅ Checked: 7 injected vars detected in your terminal
✅ Tools: `print-tooling-env`, `clean-env` scripts ready
✅ Docs: Complete policy in `docs/ENVIRONMENT_HYGIENE.md`
✅ Scripts: Windows (`.ps1`) + Linux/Mac (`.sh`)

---

## Files Added

```
scripts/env/
├── print-tooling-env.ps1    # Check injected vars
├── print-tooling-env.sh     # Check injected vars (bash)
├── clean-env.ps1            # Strip vars + run command
├── clean-env.sh             # Strip vars + run command (bash)
└── README.md                # Script reference

docs/
└── ENVIRONMENT_HYGIENE.md   # Complete policy guide

package.json
└── Added scripts:
    ├── env:check
    ├── build:deterministic
    ├── env:info
    └── dev:py:clean
```

---

## Remember

🎯 **The Rule:** Use `clean-env` for anything reproducible
🎯 **The Why:** Builds depend on environment without it
🎯 **The How:** `pwsh scripts/env/clean-env.ps1 <command>`

That's your engine-grade determinism. 🚀
