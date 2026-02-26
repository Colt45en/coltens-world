#!/usr/bin/env node
/**
 * verify-ledger.ts — Verify content-addressed diagnostic ledger integrity
 *
 * Re-computes each event's CID and verifies:
 *   - Hash chain (prev → cid links)
 *   - Canonical JSON encoding
 *   - No tampering
 *
 * Exit 0 if all events valid, 1 if any CID mismatch or chain broken.
 *
 * Usage:
 *   tsx scripts/verify-ledger.ts ledger.ndjson
 *   npx ts-node scripts/verify-ledger.ts ledger.ndjson
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

interface LedgerEvent {
  schema: string;
  cid: string;
  prev: string | null;
  runId: string;
  observedAtUtc: string;
  record: Record<string, any>;
}

function canonicalJson(obj: any): string {
  // Deterministic JSON: sorted keys, no space after separators
  // Matches Python: json.dumps(obj, sort_keys=True, separators=(",", ":"))
  // ** CRITICAL: Don't use string replace on the output!
  //    Must build JSON correctly from the start.
  const sortedObj = sortKeys(obj);
  // JSON.stringify with replacer to use compact format
  const json = JSON.stringify(sortedObj);
  // Remove ALL whitespace except inside strings
  // This is hacky but reliable: iterate char by char, skip whitespace outside strings
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }
    if (!inString && /\s/.test(char)) {
      // Skip whitespace outside strings
      continue;
    }
    result += char;
  }
  return result;
}

function sortKeys(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

function computeCid(record: Record<string, any>): string {
  const canonical = canonicalJson(record);
  return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

async function verifyLedger(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`File not found: ${filePath}`] };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { valid: false, errors: ['Ledger is empty'] };
  }

  let prevCid: string | null = null;
  let eventIndex = 0;

  for (const line of lines) {
    eventIndex++;
    let event: LedgerEvent;

    try {
      event = JSON.parse(line) as LedgerEvent;
    } catch (e) {
      errors.push(`Event ${eventIndex}: Failed to parse JSON: ${String(e)}`);
      continue;
    }

    // Validate schema
    if (event.schema !== 'we.ledger.event@1') {
      errors.push(`Event ${eventIndex}: Invalid schema "${event.schema}"`);
      continue;
    }

    // Re-compute CID
    const computedCid = computeCid(event.record);
    if (computedCid !== event.cid) {
      errors.push(
        `Event ${eventIndex}: CID mismatch\n  Expected: ${event.cid}\n  Computed: ${computedCid}`
      );
      continue;
    }

    // Verify chain
    if (event.prev !== prevCid) {
      if (eventIndex === 1) {
        // First event must have prev === null
        if (event.prev !== null) {
          errors.push(`Event ${eventIndex}: First event should have prev=null, got ${event.prev}`);
        }
      } else {
        errors.push(
          `Event ${eventIndex}: Chain broken\n  Expected prev: ${prevCid}\n  Found prev: ${event.prev}`
        );
      }
      continue;
    }

    prevCid = event.cid;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: tsx verify-ledger.ts <ledger.ndjson>');
    process.exit(1);
  }

  const filePath = args[0];
  const result = await verifyLedger(filePath);

  console.log(`\n📋 Ledger Verification Report`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (result.valid) {
    console.log(`✅ All events verified (CID checksums + chain integrity OK)\n`);
    process.exit(0);
  } else {
    console.log(`❌ Verification failed with ${result.errors.length} error(s):\n`);
    for (const err of result.errors) {
      console.log(`  ${err}\n`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
