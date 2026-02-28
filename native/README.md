# ⚙️ Native (C++ / Native Modules)

**Status**: 🟡 Build artifacts — Source control unclear

**Purpose**: Compiled native modules, C++ runtime components

**Note**: This folder contains build outputs and artifacts, not necessarily curated source code.

---

## Contents

Likely includes:
- Compiled `.dll` / `.so` / `.dylib` files
- Object files (`.obj`, `.o`)
- Visual Studio project artifacts
- Build logs and temporary files

---

## Key Issue

**Question**: Should `native/` be in git?

- ✅ If: Contains hand-written C++ source that drives builds
- ❌ If: Pure build output → Should be `.gitignore`d

**Recommended**: Verify against `build/` folder; one should be the source, other the output.

See `boundary.rules.json` and `.gitignore` for current policy.

---

**Audit Date**: 2026-02-27
