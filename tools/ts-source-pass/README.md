# TS-as-source cleanup pass (tools)

## 1) Scan + rank JS/TS twins

```bash
node tools/ts-source-pass/scan-twins.mjs --root . --out ./.ts-source-pass --verbose
```

Outputs:

- `.ts-source-pass/twin_report.json`
- `.ts-source-pass/twin_report.md`
- `.ts-source-pass/import_rewrites.json`
- `.ts-source-pass/delete_candidates.txt`

## 2) Generate diff for import rewrites (dry run)

```bash
node tools/ts-source-pass/apply-import-rewrites.mjs --root . --plan ./.ts-source-pass/import_rewrites.json > ./.ts-source-pass/import-rewrites.diff
```

## 3) Apply import rewrites

```bash
node tools/ts-source-pass/apply-import-rewrites.mjs --root . --plan ./.ts-source-pass/import_rewrites.json --write
```

## 4) Normalize versioned NDJSON (recommended if you keep knowledge.ndjson tracked)

```bash
node tools/ts-source-pass/normalize-ndjson.mjs knowledge.ndjson --key id --write
```

## 5) Deletion step (manual, after CI is green)

Use `.ts-source-pass/delete_candidates.txt` as the delete list. Delete nothing automatically.
