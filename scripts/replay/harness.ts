/**
 * REPLAY HARNESS
 *
 * Record-and-replay verification for deterministic ledger execution.
 *
 * Modes:
 * 1. RECORD: Run a workflow, capture all events + artifacts, compute checksums
 * 2. REPLAY: Feed events back in order, verify outputs match recorded hashes
 *
 * This is the core of the "deterministic replay" CI gate.
 * Fail the build if divergence occurs.
 */

import Database from 'better-sqlite3';
import {
  AnyEvent,
  ToolExecuteRequest,
  ToolExecuteResult,
  isToolRequest,
  isToolResult,
} from '@world-engine/ledger-contracts';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ReplayConfig {
  ledger_db: string;
  artifact_root: string;
  mode: 'record' | 'replay';
  tolerance?: 'strict' | 'lenient'; // strict: byte-exact; lenient: compare hashes
}

/**
 * ReplayHarness: verify deterministic execution.
 */
export class ReplayHarness {
  private config: ReplayConfig;
  private db: Database.Database;
  private checksums: Map<string, string> = new Map();

  constructor(config: ReplayConfig) {
    this.config = config;
    this.db = new Database(config.ledger_db);
  }

  /**
   * Record mode: capture events and artifact checksums.
   */
  public recordRun(events: AnyEvent[]): string {
    for (const event of events) {
      if (isToolResult(event)) {
        const result = event;

        // Hash the output
        if (result.payload.output) {
          const outputHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(result.payload.output))
            .digest('hex');

          this.checksums.set(result.call_id!, outputHash);

          // Also store artifacts if present
          if (result.payload.evidence?.artifacts) {
            for (const artifact of result.payload.evidence.artifacts) {
              // You would save the artifact here
              // For now, just record the hash
              this.checksums.set(`artifact:${artifact.ref}`, artifact.ref);
            }
          }
        }

        // Record checkpoint for this result
        const event_id = event.event_id;
        const seq = event.seq!;

        this.db.prepare(`
          INSERT INTO checkpoints (seq, hash, artifact_root, mode)
          VALUES (?, ?, ?, ?)
        `).run(seq, this.computeRunningHash(events.slice(0, seq)), this.config.artifact_root, 'record');
      }
    }

    return this.computeFinalHash(events);
  }

  /**
   * Replay mode: verify outputs match recorded hashes.
   */
  public async replayRun(events: AnyEvent[]): Promise<ReplayResult> {
    const results: ReplayCheck[] = [];
    let success = true;

    for (const event of events) {
      if (isToolResult(event)) {
        const result = event;
        const call_id = result.call_id!;

        // Compute the output hash for this execution
        const recordedHash = this.checksums.get(call_id);

        if (!recordedHash) {
          results.push({
            call_id,
            status: 'missing_baseline',
            message: `No recorded hash for ${call_id}`,
          });
          success = false;
          continue;
        }

        const currentHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(result.payload.output))
          .digest('hex');

        const match = currentHash === recordedHash;

        if (!match) {
          results.push({
            call_id,
            status: 'diverged',
            expected: recordedHash,
            actual: currentHash,
            message: `Output hash mismatch for ${call_id}`,
          });
          success = false;
        } else {
          results.push({
            call_id,
            status: 'match',
            message: `Output verified for ${call_id}`,
          });
        }
      }
    }

    return {
      success,
      checks: results,
      final_hash: this.computeFinalHash(events),
    };
  }

  /**
   * Compute running hash up to a seq number.
   * (Merkle-like: hash of all payloads so far)
   */
  private computeRunningHash(events: AnyEvent[]): string {
    const hashes = events.map(e => e.payload_hash);
    const concatenated = hashes.join('');
    return crypto.createHash('sha256').update(concatenated).digest('hex');
  }

  /**
   * Compute final hash of the entire run.
   */
  private computeFinalHash(events: AnyEvent[]): string {
    return this.computeRunningHash(events);
  }

  /**
   * Serialize checksums to file for comparison.
   */
  public saveCheckpoints(filePath: string): void {
    const data = {
      mode: this.config.mode,
      checkpoints: Array.from(this.checksums.entries()),
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Load checksums from file.
   */
  public loadCheckpoints(filePath: string): void {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.checksums = new Map(data.checkpoints);
  }

  /**
   * Close DB.
   */
  public close(): void {
    this.db.close();
  }
}

export interface ReplayCheck {
  call_id: string;
  status: 'match' | 'diverged' | 'missing_baseline';
  expected?: string;
  actual?: string;
  message: string;
}

export interface ReplayResult {
  success: boolean;
  checks: ReplayCheck[];
  final_hash: string;
}

/**
 * CI gate: run a test workflow twice and compare checksums.
 */
export async function verifyReplayParity(
  ledgerDb: string,
  testWorkflow: () => Promise<AnyEvent[]>,
  artifactRoot: string
): Promise<{ passed: boolean; divergences: string[] }> {
  const divergences: string[] = [];

  // First run: record
  const harness1 = new ReplayHarness({
    ledger_db: ledgerDb,
    artifact_root: artifactRoot,
    mode: 'record',
  });

  const events1 = await testWorkflow();
  const hash1 = harness1.recordRun(events1);
  harness1.saveCheckpoints(path.join(artifactRoot, 'checkpoint-1.json'));
  harness1.close();

  // Second run: replay
  const harness2 = new ReplayHarness({
    ledger_db: ledgerDb,
    artifact_root: artifactRoot,
    mode: 'replay',
  });

  harness2.loadCheckpoints(path.join(artifactRoot, 'checkpoint-1.json'));
  const events2 = await testWorkflow();
  const result = await harness2.replayRun(events2);
  harness2.close();

  if (!result.success) {
    result.checks.forEach(check => {
      if (check.status !== 'match') {
        divergences.push(check.message);
      }
    });
  }

  if (result.final_hash !== hash1) {
    divergences.push(`Final hash mismatch: ${hash1} vs ${result.final_hash}`);
  }

  return {
    passed: divergences.length === 0,
    divergences,
  };
}

/**
 * Example usage in a test:
 *
 * test('deterministic replay', async () => {
 *   const result = await verifyReplayParity(
 *     'ledger.db',
 *     async () => {
 *       // Your workflow here
 *       const nucleus = new Nucleus();
 *       await nucleus.runWorkflow(...);
 *       return nucleus.ledger.getAllEvents();
 *     },
 *     './artifacts'
 *   );
 *
 *   if (!result.passed) {
 *     console.error('Divergences:', result.divergences);
 *     throw new Error('Replay verification failed');
 *   }
 * });
 */
