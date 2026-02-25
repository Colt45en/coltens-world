# MIGRATION PLAN: Collapse to Coltens-World Single Root

**Status**: Ready to Execute
**Timeline**: 2-4 hours (assumes clean testing afterward)
**Risk**: Low (all operations reversible via git)

---

## Overview

Current state:
```
c:\Users\colte\colten projects\
├── coltens world/              ← The REAL repo (has packages/, apps/, git)
├── [orphaned files]
└── ...
```

Target state:
```
c:\Users\colte\colten projects\
├── coltens-world/              ← Single root; no spaces
│   ├── .git/
│   ├── apps/
│   ├── packages/
│   ├── .github/workflows/
│   ├── ARCHITECTURE.md
│   └── ...
└── [nothing else]
```

---

## Phase 1: Preparation (10 minutes)

### 1a) Verify current git state
```bash
cd "c:\Users\colte\colten projects\coltens world"
git status
git log --oneline -5
```

✅ Expected: Clean working tree, recent commit visible.

### 1b) Create backup branch
```bash
git branch backup/before-migration
git log --oneline -1
# Note the hash
```

✅ Expected: Backup branch created (safe checkpoint).

### 1c) Ensure all tests pass **locally**
```bash
pnpm run lint
pnpm run typecheck
pnpm run test:unit
pnpm run build
```

✅ Expected: All green (or warnings only).

---

## Phase 2: Rename Directory (5 minutes)

### 2a) Rename the folder (with git)

**Windows PowerShell:**
```powershell
cd "c:\Users\colte\colten projects"
mv "coltens world" "coltens-world"
cd coltens-world
git status
```

✅ Expected: Git sees the rename as a directory rename (no content changes).

### 2b) Verify git still works
```bash
git log --oneline -1
git branch
```

✅ Expected: Git history intact, all branches visible.

---

## Phase 3: Clean Up Root (10 minutes)

The outer directory (`c:\Users\colte\colten projects`) currently likely has:
- Duplicate `.github/` (should only be in root git repo)
- Duplicate `.vscode/` (should consolidate)
- Root `package.json` (may not be needed)
- Various orphaned files

### 3a) Check what's in the outer directory

```bash
cd "c:\Users\colte\colten projects"
ls -la
```

### 3b) Move any important files into `coltens-world/`

Example (check your actual files first):
```bash
# If outer directory has important config:
cp .editorconfig coltens-world/ 2>/dev/null
cp CONTRIBUTING.md coltens-world/ 2>/dev/null
cp .prettierrc.json coltens-world/ 2>/dev/null

# Then verify it's in the repo:
cd coltens-world
git status  # Should show new files ready to add
```

### 3c) If there's a duplicate `.github/` in the outer dir, remove it
```bash
# Only do this if you already have .github/workflows in coltens-world/
rm -r "..\coltens world\.github" 2>/dev/null
```

### 3d) Commit any migrations into the repo
```bash
cd coltens-world
git add .
git commit -m "chore: migrate config files to repo root"
```

---

## Phase 4: Purge Generated Files from Git (15 minutes)

These should be in Git *as commits* but not in working tree going forward.

### 4a) List what's currently tracked
```bash
git ls-files | grep -E "(dist|build|node_modules)" | head -20
```

✅ Expected: Ideally nothing (but there might be some if previously committed).

### 4b) If found, remove and commit removal

**Do NOT do this yet if you're unsure.** Instead:

```bash
# List all tracked build outputs
git ls-files | grep -E "dist/|build/" > /tmp/tracked-outputs.txt
cat /tmp/tracked-outputs.txt
```

If the list is long, you can:

```bash
# Soft remove (don't actually delete locally yet)
git rm -r --cached dist/ build/ node_modules/ .venv/ 2>/dev/null
git commit -m "chore: remove generated outputs from git tracking"
```

✅ This removes them from version control but keeps local copies.

---

## Phase 5: Verify .gitignore Coverage (10 minutes)

### 5a) Test .gitignore rules
```bash
# Build to populate dist/
pnpm install
pnpm build

# Check that dist/ is ignored
git status
```

✅ Expected: `dist/`, `.turbo/`, `node_modules/` do NOT appear in `git status`.

### 5b) Check for any surprises
```bash
git ls-files --others --exclude-standard | head -20
```

✅ Expected: Nothing surprising (no dist/, no node_modules/).

---

## Phase 6: CI/CD Setup (15 minutes)

### 6a) Add pnpm preinstall guard

Open `package.json` in the root, ensure:

```json
{
  "scripts": {
    "preinstall": "npx only-allow pnpm",
    "postinstall": "pnpm run ?build 2>/dev/null || true"
  }
}
```

Then:
```bash
npm install -g only-allow  # Or use pnpm exec
pnpm install
npm install  # This should FAIL with "Use pnpm" message
```

✅ Expected: npm install fails with "Only pnpm allowed" message.

### 6b) Activate GitHub Actions workflows

All workflows are already in `.github/workflows/`:
- `ci.yml` (PR gate)
- `e2e.yml` (scheduled E2E)
- `codegen.yml` (schema validation)
- `security.yml` (dependency scan)

On your next push to GitHub, they'll activate automatically.

### 6c) Create CODEOWNERS file

```bash
cat > .github/CODEOWNERS << 'EOF'
# Default reviewers
* @coltensanders1295

# Boundary rules require explicit approval
boundary.rules.json @coltensanders1295
ARCHITECTURE.md @coltensanders1295

# Critical packages
packages/contracts/ @coltensanders1295
packages/protocol/ @coltensanders1295
packages/engine/ @coltensanders1295

# App-specific owners
apps/nucleus/ @coltensanders1295
apps/ide-web/ @coltensanders1295
EOF

git add .github/CODEOWNERS
git commit -m "chore: add CODEOWNERS"
```

---

## Phase 7: Validate Everything Works (20 minutes)

### 7a) Full clean build

```bash
# Remove all caches
rm -r node_modules .turbo .venv 2>/dev/null

# Full install + build
pnpm install
pnpm run lint
pnpm run typecheck
pnpm run test:unit
pnpm run build
```

✅ Expected: All commands succeed.

### 7b) Run repo doctor
```bash
node scripts/repo-doctor.mjs
```

✅ Expected: Green checks on all critical health checks.

### 7c) Verify git state
```bash
git status
git log --oneline -5
```

✅ Expected: All commits visible, working tree clean.

---

## Phase 8: Push to GitHub (5 minutes)

### 8a) Add GitHub remote (one-time)

Get the URL from your GitHub repo (e.g., `https://github.com/coltensanders/coltens-world`):

```bash
git remote add origin https://github.com/coltensanders/coltens-world.git
git branch -M main  # Rename master → main if needed
git push -u origin main
```

### 8b) Verify workflows trigger

On GitHub.com, check **Actions** tab. You should see:
- ✅ CI workflow running
- ✅ Tests passing
- ✅ Build succeeding

### 8c) Celebrate 🎉

```bash
git log --oneline -1
# Should show your final migration commit
```

---

## Phase 9: Post-Migration Cleanup (10 minutes)

### 9a) Delete backup branch (optional, after confirming success)
```bash
git branch -d backup/before-migration
git push origin --delete backup/before-migration
```

### 9b) Optional: Delete the outer directory in VS Code

If all code is now in `coltens-world/`, you can safely close the outer workspace:
- File → Close Folder
- File → Open Folder → `c:\Users\colte\colten projects\coltens-world`

### 9c) Update any local shortcuts / documentation

Any scripts or docs that reference `coltens world/` should now reference `coltens-world/`.

---

## Rollback Plan (If Needed)

If anything breaks, you have **two escape hatches**:

### Quick rollback (within session)
```bash
git reset --hard HEAD~1  # Undo last commit
git reflog              # See all states
```

### Full rollback (repository reset)
```bash
cd c:\Users\colte\colten projects
git checkout backup/before-migration
# Or restore from GitHub if pushed
```

---

## Expected Outcomes

**After migration completes:**

✅ Single, clean repository root
✅ No spaces in directory names
✅ All build outputs gitignored
✅ CI/CD workflows active on GitHub
✅ Architecture rules enforced
✅ Deterministic rebuild on clean checkout
✅ Team can clone and build in 5 minutes

---

## Common Issues & Fixes

### Issue: "dist/ still showing in git status"
**Fix**: `git rm -r --cached dist/` then `git commit -m "remove dist"`

### Issue: "pnpm install fails after rename"
**Fix**: Delete `pnpm-lock.yaml.bak`, run `pnpm install --frozen-lockfile` again

### Issue: "GitHub Actions won't trigger"
**Fix**:
- Verify workflows are in `.github/workflows/`
- Ensure branch is `main` (or update workflow `on:` branches)
- Check GitHub repo settings → Actions → is it enabled?

### Issue: "Boundary check fails but I think it's wrong"
**Fix**: Add exception to `boundary.rules.json` with detailed reason

---

## Estimated Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Preparation | 10 min |
| 2 | Rename directory | 5 min |
| 3 | Clean up root | 10 min |
| 4 | Purge outputs | 15 min |
| 5 | Verify .gitignore | 10 min |
| 6 | CI/CD setup | 15 min |
| 7 | Validation | 20 min |
| 8 | GitHub push | 5 min |
| 9 | Cleanup | 10 min |
| **Total** | | **1.5 hours** |

Plus ~2 hours for comprehensive testing afterward.

---

## After Migration: Team Onboarding

Once migrations is done, new developers should:

```bash
# 1. Clone the repo
git clone https://github.com/coltensanders/coltens-world.git
cd coltens-world

# 2. Run setup script
pnpm install

# 3. Read architecture
cat ARCHITECTURE.md

# 4. Start dev
pnpm run dev

# 5. All tests should pass
pnpm run test:unit
pnpm run test:e2e  # (nightly job, optional)
```

Expected time: **< 5 minutes** (install is slow, but deterministic).

---

## Checklist

- [ ] Run Phase 1: git backup created
- [ ] Run Phase 2: directory renamed to `coltens-world`
- [ ] Run Phase 3: root cleaned up
- [ ] Run Phase 4: outputs removed from git
- [ ] Run Phase 5: .gitignore validated
- [ ] Run Phase 6: CI/CD configured
- [ ] Run Phase 7: full build passes
- [ ] Run Phase 8: pushed to GitHub
- [ ] Verified CI passes on GitHub
- [ ] Updated local workspace path
- [ ] Team notified of new repo structure

---

## Questions?

Refer to:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Design principles
- [boundary.rules.json](./boundary.rules.json) - Import rules
- [.github/workflows/](../.github/workflows/) - CI pipelines
- Git history for commit messages

---

**Status**: Ready to Execute
**Next Action**: Start Phase 1 Preparation
**Risk**: Low (all reversible)
**Success Criteria**: Clean checkout → full build pass on CI ✅
