# Contract-Driven Integration: Complete Setup Guide

**Status**: Contract infrastructure ready for integration testing and production hardening
**Date**: February 11, 2026

## Overview

This document provides a comprehensive checklist for integrating the **contract-driven architecture** into the World Engine ecosystem. The infrastructure consists of:

- **Canonical Contract Spec** (Python Pydantic models)
- **Generated OpenAPI Schema** (deterministically serialized JSON)
- **Generated TypeScript Types** (via openapi-typescript)
- **HTTP Client Wrapper** (@we/contracts TypeScript package)

## Phase 1: Contract Generation & Validation ✅ READY

### Checklist

- [ ] **1.1**: Verify Python environment

  ```bash
  cd apps/py-sidecar
  pip install -r requirements.txt
  # or
  poetry install
  ```

- [ ] **1.2**: Generate OpenAPI schema

  ```bash
  pnpm contracts:export
  # Expected output: packages/contracts/openapi/openapi.json (created)
  ```

- [ ] **1.3**: Inspect generated OpenAPI

  ```bash
  cat packages/contracts/openapi/openapi.json | jq '.paths | keys'
  # Expected: ["/autonomy/v1/ingest", "/autonomy/v1/run-batch", ...]
  ```

- [ ] **1.4**: Install TypeScript codegen dependency

  ```bash
  pnpm install
  # Adds: openapi-typescript@^6.7.5
  ```

- [ ] **1.5**: Generate TypeScript types

  ```bash
  pnpm contracts:ts
  # Expected output: packages/contracts/ts/types.ts (created, ~500 LOC)
  ```

- [ ] **1.6**: Build contracts package

  ```bash
  pnpm -C packages/contracts build
  # Expected output: packages/contracts/dist/index.js, ...
  ```

- [ ] **1.7**: Run contract sync check
  ```bash
  pnpm contracts:check
  # Expected: ✅ All contracts synchronized
  ```

### Success Criteria

- ✅ `packages/contracts/openapi/openapi.json` exists (>10KB)
- ✅ `packages/contracts/ts/types.ts` exists (>500 LOC)
- ✅ `pnpm contracts:check` exits with code 0
- ✅ TypeScript types import without errors: `import { AutonomyLoopClient } from "@we/contracts"`

---

## Phase 2: Integration Testing ⏳ IN PROGRESS

### Checklist

- [ ] **2.1**: Start Autonomy Loop API

  ```bash
  # Terminal 1
  cd apps/py-sidecar
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
  ```

- [ ] **2.2**: Test API connectivity

  ```bash
  curl -s http://localhost:8001/docs | head -20
  # Expected: Swagger UI HTML (OpenAPI interactive docs)
  ```

- [ ] **2.3**: Test runBatch endpoint

  ```bash
  curl -X POST http://localhost:8001/autonomy/v1/run-batch \
    -H "content-type: application/json" \
    -d '{
      "source_id": "test:integration",
      "kind": "code",
      "language_hint": "TypeScript",
      "text": "const x = 42;"
    }' | jq '.'
  # Expected: Full RunBatchResponse with all 5 artifacts
  ```

- [ ] **2.4**: Run integration tests

  ```bash
  pnpm test packages/contracts/__tests__/integration.test.ts
  # Expected: All test suites pass
  ```

- [ ] **2.5**: Verify determinism

  ```bash
  curl -X POST http://localhost:8001/autonomy/v1/replay-last \
    -H "content-type: application/json" \
    -d '{"n": 25}' | jq '.ok'
  # Expected: true (no drift detected)
  ```

- [ ] **2.6**: Test error handling
  ```bash
  # Invalid request (missing 'text' field)
  curl -X POST http://localhost:8001/autonomy/v1/run-batch \
    -H "content-type: application/json" \
    -d '{"source_id": "test"}' | jq '.error'
  # Expected: Error response with details
  ```

### Success Criteria

- ✅ API responds to all 4 endpoints
- ✅ All integration tests pass
- ✅ Responses match generated TypeScript types
- ✅ Error handling works as documented
- ✅ Determinism check shows `ok: true`

---

## Phase 3: Application Integration ⏳ TODO

### 3a: Nucleus Integration

- [ ] **3a.1**: Add @we/contracts to apps/nucleus

  ```bash
  cd apps/nucleus
  pnpm add @we/contracts
  ```

- [ ] **3a.2**: Create Autonomy Service
  - File: `apps/nucleus/src/services/autonomyService.ts`
  - Reference: [Nucleus Integration Guide](./AUTONOMY_INTEGRATION_NUCLEUS.md)

- [ ] **3a.3**: Register bus handlers
  - Subscribe to `analysis` channel
  - Routes: `analyze.file`, `governance.tags`, `determinism.check`

- [ ] **3a.4**: Test Nucleus → Autonomy Loop
  ```bash
  # Send analysis request through bus
  const result = await bus.request("analysis", "analyze.file", {
    filepath: "src/test.ts",
    content: "const x = 1;",
  });
  ```

### 3b: IDE Web Integration

- [ ] **3b.1**: Add @we/contracts to apps/ide-web

  ```bash
  cd apps/ide-web
  pnpm add @we/contracts
  ```

- [ ] **3b.2**: Create analysis hook
  - File: `apps/ide-web/src/hooks/useAnalyzeFile.ts`
  - Use: `bus.request("analysis", "analyze.file", ...)`

- [ ] **3b.3**: Create CodeAnalyzer component
  - File: `apps/ide-web/src/components/CodeAnalyzer.tsx`
  - Displays: plan status, evidence, lexicon, decision

- [ ] **3b.4**: Wire into editor UI
  - Show analysis panel when user opens code file
  - Trigger analysis on code changes (debounced)

### 3c: Preview Runtime Integration (Optional)

- [ ] **3c.1**: Add @we/contracts if runtime analysis needed
- [ ] **3c.2**: Use for runtime code validation

### Success Criteria

- ✅ Nucleus can receive analysis requests
- ✅ IDE Web can display analysis results
- ✅ Request/response types match @we/contracts
- ✅ No TypeScript compilation errors
- ✅ Analysis results appear in IDE within 2 seconds

---

## Phase 4: Production Hardening ⏳ TODO

### 4a: Error Handling & Resilience

- [ ] **4a.1**: Implement retry logic
  - Transient errors: retry up to 3 times with exponential backoff
  - Permanent errors: fail fast with user message

- [ ] **4a.2**: Generate error documentation
  - All error codes documented
  - User-friendly error messages
  - Recovery suggestions

- [ ] **4a.3**: Circuit breaker pattern
  - Track API failures
  - Fallback mode if API is down
  - Graceful degradation

### 4b: Performance Optimization

- [ ] **4b.1**: Implement request caching
  - Cache analysis for identical inputs
  - TTL-based invalidation (e.g., 5 minutes)

- [ ] **4b.2**: Add batch request optimization
  - Combine multiple requests if possible
  - Parallel processing for independent files

- [ ] **4b.3**: Monitor performance metrics
  - Request latency (p50, p95, p99)
  - Error rates
  - Cache hit rate

### 4c: Security Hardening

- [ ] **4c.1**: Add request authentication
  - SessionId validation
  - Optional JWT token support

- [ ] **4c.2**: Rate limiting
  - Per-session limits
  - Per-IP limits

- [ ] **4c.3**: Input validation
  - Max code size (e.g., 1MB)
  - Filename validation
  - Language hint validation

### 4d: Monitoring & Observability

- [ ] **4d.1**: Add logging
  - Request/response logging (non-sensitive)
  - Error logging with stack traces
  - Analytics: feature usage

- [ ] **4d.2**: Add tracing
  - Distributed tracing (OpenTelemetry compatible)
  - Track request through all 5 roles

- [ ] **4d.3**: Health checks
  - `/health` endpoint
  - Database connectivity check
  - Dependency status

### 4e: Documentation & Support

- [ ] **4e.1**: API documentation
  - Inline JSDoc with examples
  - Error codes reference
  - Type definitions reference

- [ ] **4e.2**: Integration examples
  - Complete working examples for each language
  - Common patterns and anti-patterns
  - Troubleshooting guide

- [ ] **4e.3**: Runbooks
  - How to update contracts
  - How to rollback changes
  - How to debug integration issues

### Success Criteria

- ✅ 99.5% uptime in staging environment
- ✅ p95 latency < 2 seconds
- ✅ All error codes have user-friendly messages
- ✅ Comprehensive logs for debugging
- ✅ Documentation covers all integration scenarios

---

## Phase 5: Deployment & Release ⏳ TODO

### 5a: Staging Environment

- [ ] **5a.1**: Deploy to staging
  - All services (Nucleus, IDE Web, Autonomy Loop API)
  - Full integration testing

- [ ] **5a.2**: Run load tests
  - 100 concurrent users
  - Sustained for 5 minutes
  - Check error rates and latency

- [ ] **5a.3**: Run chaos engineering tests
  - Kill Autonomy Loop API, verify graceful fallback
  - Slow down API responses, verify timeouts work
  - Corrupt data, verify validation catches it

### 5b: Production Deployment

- [ ] **5b.1**: Update documentation
  - User guide for new analysis features
  - API changelog
  - Breaking changes (if any)

- [ ] **5b.2**: Deploy to production
  - Blue-green deployment if possible
  - Canary deployment if not

- [ ] **5b.3**: Monitor post-deployment
  - Check for errors in logs
  - Monitor performance metrics
  - Gather user feedback

### Success Criteria

- ✅ Zero critical bugs in first week
- ✅ Positive user feedback
- ✅ Stable performance metrics

---

## Monitoring Dashboard

Once deployed, track these KPIs:

| Metric                          | Target | Alert Threshold |
| ------------------------------- | ------ | --------------- |
| API Availability                | 99.5%  | < 99%           |
| p95 Latency                     | < 2s   | > 5s            |
| Error Rate                      | < 0.5% | > 1%            |
| Determinism Check Pass Rate     | 100%   | < 99.9%         |
| Cache Hit Rate                  | > 60%  | < 40%           |
| Database Connection Pool Active | < 50%  | > 80%           |

---

## Troubleshooting Guide

### Issue: TypeScript types don't import

**Solution:**

```bash
# Regenerate types
pnpm contracts:gen

# Type check the contracts package
pnpm -C packages/contracts type-check
```

### Issue: API returns 500 error

**Solution:**

1. Check Autonomy Loop API logs
2. Verify database is running
3. Check taxonomy tags are seeded: `pnpm -C apps/py-sidecar run cli taxonomy-list`

### Issue: Analysis requests timeout

**Solution:**

1. Increase timeout in client config
2. Check if API is slow: measure with curl
3. Check database query performance

### Issue: Determinism check fails (drift detected)

**Solution:**

1. Check if taxonomy tags changed
2. Verify database is not corrupted
3. Run `replay-last` with `--fail-on-unknown-tag=false` to ignore tag mismatches

---

## Files Reference

### Contract Infrastructure

- **Canonical Spec**: `apps/py-sidecar/contracts.py`
- **OpenAPI Export Tool**: `tooling/codegen/export_openapi.py`
- **TypeScript Codegen**: `tooling/codegen/gen_ts_types.js`
- **Contract Check Tool**: `tooling/codegen/check_contracts.js`

### Generated Artifacts

- **OpenAPI Schema**: `packages/contracts/openapi/openapi.json` (generated)
- **TypeScript Types**: `packages/contracts/ts/types.ts` (generated)

### Implementation

- **HTTP Client**: `packages/contracts/ts/client.ts`
- **Barrel Export**: `packages/contracts/ts/index.ts`
- **Package Config**: `packages/contracts/package.json`
- **Package TSConfig**: `packages/contracts/tsconfig.json`

### Documentation

- **Contracts README**: `packages/contracts/README.md`
- **Nucleus Integration**: `docs/AUTONOMY_INTEGRATION_NUCLEUS.md`
- **IDE Integration**: `docs/AUTONOMY_INTEGRATION_IDE.md`
- **This File**: `docs/CONTRACT_INTEGRATION_CHECKLIST.md`

### Tests

- **Integration Tests**: `packages/contracts/__tests__/integration.test.ts`

---

## Support & Questions

For questions or issues:

1. Check [packages/contracts/README.md](packages/contracts/README.md) for API documentation
2. Review [integration tests](packages/contracts/__tests__/integration.test.ts) for examples
3. Check troubleshooting section above
4. Review logs from Autonomy Loop API
5. Run `pnpm contracts:check` to verify contract sync

---

## Summary Timeline

```
Week 1: ✅ Contract generation & validation (NOW)
       └─ Generate OpenAPI spec, TypeScript types, build package

Week 2: ⏳ Integration testing (NEXT)
       └─ Test API connectivity, run integration tests, verify types

Week 3: ⏳ Application integration
       └─ Wire into Nucleus, IDE Web, update UI

Week 4: ⏳ Production hardening
       └─ Error handling, caching, monitoring, logging

Week 5: ⏳ Deployment & release
       └─ Staging tests, production deployment, monitoring
```

---

**Generated**: February 11, 2026
**By**: GitHub Copilot
**Status**: Production-grade contract infrastructure ready for integration
