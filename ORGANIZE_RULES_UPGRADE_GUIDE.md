# 📋 organize_rules.py Upgrade Path

## What Changed (Bugs Fixed)

| Bug | Your Code | Fix | Impact |
|-----|-----------|-----|--------|
| **Move destination** | Creates parent only if missing | Detects dir vs file; mkdir(dest) when needed | Files go to correct folder |
| **Snapshot mutation** | `rglob('*')` then move/delete while iterating | Deterministic snapshot, skip moved/deleted ancestors | No "path not found" crashes |
| **stat() on missing** | `path.stat()` crashes if moved earlier | Try/except FileNotFoundError → return False | Graceful handling |
| **Debug spam** | Prints every action | Add --verbose flag, silent by default | Clean CLI output |
| **Timestamps** | Local time (ambiguous) | UTC + run_id + config_hash | Auditable, deterministic |
| **Journal incomplete** | Records move/delete only | Also records mkdir + create_file | Full undo support |
| **Destination format** | Uses `{parent}` as Path object (OS-dependent) | String-based vars only | Portable |
| **Pattern matching** | `path.name` only (shallow) | `relpath` option + glob on full path | Can target nested structures |

---

## Files to Update

### Option A: Full Replacement (Recommended)

**Before:**
```bash
cd coltens\ world
python organize_rules.py rules.organize.yaml --dry-run
```

**After (same CLI):**
```bash
python organize_rules.py rules.organize.yaml --dry-run    # Quiet mode
python organize_rules.py rules.organize.yaml --verbose    # With actions printed
python organize_rules.py rules.organize.yaml --undo       # Undo journals
```

### Option B: Surgical Patches (if you want to keep other customizations)

Key sections to replace:

1. **Lines 1–26**: Module docstring + imports (add `hashlib`, `timezone`, `dataclass`)
2. **Lines ~80–120**: New `snapshot_items()` function (replace entire rglob usage)
3. **Lines ~160–200**: New `_check_condition()` method (add FileNotFoundError handling)
4. **Lines ~230–280**: New `_resolve_move_target()` method (dir vs file logic)
5. **Lines ~280–330**: New `_trash_path()` method (reversible delete)
6. **Lines ~330–370**: New `process_rules()` with moved_or_deleted_dirs tracking
7. **Lines ~400+**: New undo_last_run() with full operation reversal

---

## YAML Contract (No Changes Needed)

Your existing `rules.organize.*.yaml` files will work **as-is**. New optional fields:

```yaml
rules:
  - id: example
    pattern: "*"
    match: "name"                          # or "relpath" (NEW)
    condition:
      is_folder: true
      name_pattern: "*.txt"
      path_pattern: "docs/*"               # (NEW) - glob on full relpath
      min_age_days: 7
      max_age_days: 30
      file_type: document | image | code
      parent_not: [".git", ".trash"]
      has_file: "*.md"
    action: move | delete | trash | ensure_structure
    destination: "Organized/{yyyy}/{yyyymm}/{stem}"
    structure: ["inbox", "processing", "archive"]
```

---

## Migration Checklist

- [ ] **Backup existing rules files** (they're still compatible)
- [ ] **Keep old journal** (optional; can delete if you don't need undo for old runs)
- [ ] **Test with --dry-run first**:
  ```bash
  python organize_rules.py rules.organize.downloads.yaml --dry-run --verbose
  ```
- [ ] **Verify audit trail** points to correct location
  ```bash
  ls -la organizer_actions.ndjson  # Should have new entries
  ```
- [ ] **Run for real** (creates journal beside rules file):
  ```bash
  python organize_rules.py rules.organize.downloads.yaml --verbose
  ```
- [ ] **Test undo** (reverses move + trash, leaves delete permanent):
  ```bash
  python organize_rules.py rules.organize.downloads.yaml --undo
  ```

---

## World Engine Integration (Ledger-Ready)

The upgraded script already:
- ✅ Uses UTC timestamps (timezone.utc)
- ✅ Includes run_id + config_hash for determinism
- ✅ Tries `servers.audit.append_ndjson` (your ledger hook)
- ✅ Falls back to local ndjson if not available
- ✅ Every action is logged (start, complete, error, undo, etc.)

**To emit real ledger events**, you can:

1. **Option 1**: Hook the `log_action()` method to emit typed events:
   ```python
   def log_action(self, action: str, **kwargs: Any) -> None:
       # Emit organizer.run.{action} event
       event = {
           "v": "1.0",
           "type": f"organizer.run.{action}",
           "id": randomId("org"),
           "ts": nowMs(),
           "from": {"role": "organizer", "instance": self.run_id},
           "traceId": self.run_id,
           "payload": kwargs
       }
       append_ledger_event(event)  # Replace append_ndjson
   ```

2. **Option 2**: Run `organize_rules.py` from a Nucleus route that emits events to wsHub

Either way, you have a **full audit trail** of every file operation.

---

## Example: Downloads Organizer

```yaml
name: Downloads Organizer
description: Sort downloads, trash junk, create INDEX
target_folder: ~/Downloads
audit_log: organizer_actions.ndjson

rules:
  # 1. Ensure folder structure exists
  - id: ensure_root_structure
    pattern: "*"
    match: relpath
    condition:
      is_folder: true
      path_pattern: "."
    action: ensure_structure
    structure:
      - Documents
      - Images
      - Archives
      - Installers
      - Temp

  # 2. Move documents
  - id: move_documents
    pattern: "*"
    match: name
    condition:
      file_type: document
    action: move
    destination: Documents/{yyyymm}

  # 3. Move images
  - id: move_images
    pattern: "*"
    match: name
    condition:
      file_type: image
    action: move
    destination: Images/{yyyy}

  # 4. Archive old temp files
  - id: trash_old_temp
    pattern: "*.tmp"
    match: name
    condition:
      min_age_days: 7
    action: trash

post_actions:
  - type: create_index
    path: INDEX.md
    content: |
      # Downloads Index
      Last updated: {timestamp}

      ## Structure
      {folder_tree}

      ## Stats
      - Total items processed: {total_items_snapshot}
      - Moved: {moved_count}
      - Trashed: {trashed_count}
      - Created folders: {created_folders}
      - Errors: {errors}

      Run ID: organizer_{run_id}
```

Run it:
```bash
python organize_rules.py rules.organize.downloads.yaml --dry-run --verbose
python organize_rules.py rules.organize.downloads.yaml --verbose
python organize_rules.py rules.organize.downloads.yaml --undo
```

---

## What I Can Do Next

Choose one:

### 🔧 A) Full Rewrite
I replace the entire file with production-grade version (all 900+ lines). You get:
- Deterministic processing
- Safe moves + trash (with undo)
- Full event audit trail
- --verbose flag
- Nested pattern matching

**Time**: 5 min | **Risk**: Low (backward compatible)

### 📝 B) Document Migration Path
You manually apply patches from this doc. Gives you control over what changes.

**Time**: 30 min | **Risk**: Medium (easy to miss a section)

### 🎯 C) World Engine Native
I wire it to emit **actual ledger events** (organizer.run.started, organizer.item.moved, etc.) instead of just ndjson. Requires your event contract.

**Time**: 15 min | **Risk**: Low (just swaps append_ndjson hook)

---

**Which path?**
