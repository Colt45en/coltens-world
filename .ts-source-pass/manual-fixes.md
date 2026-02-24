# Manual Fixes — Unresolved Imports Cleanup

## Result

- Previous unresolved imports: **13**
- Current unresolved imports: **0**
- Root cause: scanner was matching import paths inside comments and failing to resolve pseudo-extension imports like `*.schema`.

## Exact file edits applied

### 1) Ignore commented imports during scan

**File:** `tools/ts-source-pass/scan-twins.mjs`

**Before**

```js
function scanImports(text){
  const out = [];
  for (const re of importRe){
    let m;
    while ((m = re.exec(text)) !== null){
      out.push(m[1]);
    }
  }
  return out;
}
```

**After**

```js
function scanImports(text){
  const out = [];
  const scanText = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  for (const re of importRe){
    let m;
    while ((m = re.exec(scanText)) !== null){
      out.push(m[1]);
    }
  }
  return out;
}
```

### 2) Resolve `.js` specs to TS twins

**File:** `tools/ts-source-pass/scan-twins.mjs`

**Added behavior in `tryResolveImport`**

- When an import explicitly ends with `.js/.jsx/.mjs/.cjs`, scanner now also tries `*.ts` and `*.tsx` counterparts.

### 3) Resolve pseudo-extension imports (`.schema`, etc.)

**File:** `tools/ts-source-pass/scan-twins.mjs`

**Before**

- Any non-empty extension was treated as fully-qualified, so `./x.schema` could not resolve to `./x.schema.ts`.

**After**

- Introduced `knownExts` (`.ts/.tsx/.js/.jsx/.mjs/.cjs`).
- If extension is unknown (for example `.schema`), scanner now tries:
  - `base + .ts/.tsx/.js/.jsx/.mjs/.cjs`
  - and standard extensionless candidates.

## Verification commands run

```bash
node tools/ts-source-pass/scan-twins.mjs --root . --out ./.ts-source-pass --verbose
```

## Verification artifact

- `.ts-source-pass/unresolved_imports.json` now contains:

```json
[]
```

## Notes

- No production source imports were modified in this cleanup step.
- This pass fixed scanner correctness so unresolved import reporting is now actionable.
