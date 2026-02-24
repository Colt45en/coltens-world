#!/usr/bin/env bash
# =========================
# repo-doctor.sh
# Production repo guardrails enforcement
# Fails CI if forbidden artifacts are tracked or hygiene rules violated
# =========================
set -euo pipefail

die() { echo "❌ repo-doctor: $*" >&2; exit 1; }
warn() { echo "⚠️  repo-doctor: $*" >&2; }
ok() { echo "✅ repo-doctor: $*"; }

# Verify we're in a git repo
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repo."

ROOT="$(git rev-parse --show-toplevel)"
BASENAME="$(basename "$ROOT")"

echo "🧪 repo-doctor running at: $ROOT"

# --- Repo root folder name: no spaces ---
if [[ "$BASENAME" == *" "* ]]; then
  die "Repo root folder contains spaces: '$BASENAME'. Rename it (scripts, CI, and cross-platform tooling will suffer)."
fi

cd "$ROOT"

# --- Enforce single workspace root config files ---
[[ -f "pnpm-lock.yaml" ]] || die "Missing pnpm-lock.yaml at repo root. This is a pnpm workspace."
[[ -f "pnpm-workspace.yaml" ]] || warn "pnpm-workspace.yaml not found at repo root (expected for monorepo)."
[[ -f "package.json" ]] || die "Missing package.json at repo root."

# --- Enforce pnpm-only (no npm, no yarn) ---
if [[ -f "package-lock.json" ]]; then
  die "package-lock.json exists. This repo uses pnpm exclusively. Delete it and run 'pnpm install'."
fi
if [[ -f "yarn.lock" ]]; then
  die "yarn.lock exists. This repo uses pnpm exclusively. Delete it."
fi

# --- Check packageManager field in package.json ---
if ! grep -q '"packageManager".*:.*"pnpm@' package.json 2>/dev/null; then
  warn "package.json missing 'packageManager' field (recommend: \"packageManager\": \"pnpm@9.0.0\")."
fi

# --- Forbidden tracked files/dirs (must be .gitignored + untracked) ---
FORBID_PATTERNS=(
  "node_modules/"
  "*/node_modules/"
  "dist/"
  "*/dist/"
  "build/"
  "*/build/"
  ".turbo/"
  "*/.turbo/"
  ".venv/"
  "*/.venv/"
  ".pytest_cache/"
  "*/.pytest_cache/"
  "playwright-report/"
  "test-results/"
  "*/playwright-report/"
  "*/test-results/"
  "CMakeFiles/"
  "*/CMakeFiles/"
  "*.log"
  "logs/"
  "*.db"
  "*.sqlite"
  "*.sqlite3"
  ".pnpm-store/"
)

OFFENDERS=()

# Get all tracked files
while IFS= read -r f; do
  skip=0
  for pattern in "${FORBID_PATTERNS[@]}"; do
    # Simple glob matching: if pattern ends with /, check if file starts with it
    # Otherwise, check if file ends with pattern (for *.log, etc.)
    if [[ "$pattern" == */ ]]; then
      if [[ "$f" == "$pattern"* ]]; then
        OFFENDERS+=("$f")
        skip=1
        break
      fi
    elif [[ "$f" == *"$pattern"* ]]; then
      OFFENDERS+=("$f")
      skip=1
      break
    fi
  done
done < <(git ls-files)

if (( ${#OFFENDERS[@]} > 0 )); then
  echo ""
  echo "❌ Tracked forbidden artifacts detected:"
  for o in "${OFFENDERS[@]:0:20}"; do
    echo "  - $o"
  done
  if (( ${#OFFENDERS[@]} > 20 )); then
    echo "  ... and $((${#OFFENDERS[@]} - 20)) more"
  fi
  echo ""
  echo "📝 To fix:"
  echo "  1. Ensure .gitignore covers these patterns"
  echo "  2. Remove from git (do NOT delete local files):"
  echo "     git rm -r --cached <path>"
  echo ""
  die "Repo contains tracked build/cache/runtime artifacts (breaking hygiene)."
fi

# --- Warn about nested lockfiles (should be one root only) ---
NESTED_LOCKS=()
while IFS= read -r f; do
  if [[ "$f" == */pnpm-lock.yaml && "$f" != "pnpm-lock.yaml" ]]; then
    NESTED_LOCKS+=("$f")
  fi
done < <(git ls-files)

if (( ${#NESTED_LOCKS[@]} > 0 )); then
  echo ""
  echo "❌ Nested pnpm-lock.yaml files found (violates single-root principle):"
  for f in "${NESTED_LOCKS[@]}"; do
    echo "  - $f"
  done
  die "Monorepo should have exactly one pnpm-lock.yaml at repo root."
fi

# --- Success ---
echo ""
ok "All checks passed."
ok "Repo hygiene: ✅ pnpm-only, no tracked artifacts, single root"
