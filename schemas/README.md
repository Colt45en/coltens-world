# 🗂️ Schemas (Type Definitions & Validation Rules)

**Status**: 🟡 Defined but scattered — Multiple schema sources

**Purpose**: JSON schemas, OpenAPI specs, Zod definitions for contract validation

---

## Schema Sources

| Location | Format | Purpose | Status |
|----------|--------|---------|--------|
| **packages/protocol/src** | TypeScript + Zod | Message envelopes | 🟢 Source of truth |
| **packages/contracts/openapi** | OpenAPI JSON | API spec | 🟢 Auto-synced |
| **packages/contracts/ts** | TypeScript | Types (generated) | 🟢 Auto-generated |
| **schemas/** (root) | JSON Schema? | Legacy? | ⚪ Unclear |
| **rules/** files (root) | YAML | Rule definitions | 🟡 Partial |

**Issue**: Multiple schema formats; unclear which is source of truth for each domain

---

## Recommended Actions

1. **Unify schema location**: Single schema registry (Zod in protocol, OpenAPI export)
2. **Document by domain**: Avatar schemas, Engine schemas, Agent schemas
3. **Version tracking**: Schemas versioned; migration paths for breaking changes

---

**Audit Date**: 2026-02-27
