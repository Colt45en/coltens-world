/**
 * NSG v1.0 Proof Ledger
 *
 * NDJSON event emission for deterministic rewrite tracing.
 * All events are hashable and deterministic (no timestamps inside engine).
 */

/**
 * Event kinds
 */
export type ProofEventKind =
  | "nsg.rewrite.start"
  | "nsg.rewrite.pass.start"
  | "nsg.rewrite.step"
  | "nsg.rewrite.pass.end"
  | "nsg.rewrite.end";

/**
 * Base proof event
 */
export interface ProofEvent {
  kind: ProofEventKind;
  run_id: string;
  pass_index?: number;
  pass_name?: string;
  step_index?: number;
  rule_id?: string;
  focus_path?: number[];
  before_hash?: string;
  after_hash?: string;
  premises?: string[];
}

/**
 * Rewrite start event
 */
export interface RewriteStartEvent extends ProofEvent {
  kind: "nsg.rewrite.start";
  input_hash: string;
  policy_hash: string;
}

/**
 * Pass start event
 */
export interface PassStartEvent extends ProofEvent {
  kind: "nsg.rewrite.pass.start";
  pass_index: number;
  pass_name: string;
}

/**
 * Rewrite step event (emitted only on changes)
 */
export interface RewriteStepEvent extends ProofEvent {
  kind: "nsg.rewrite.step";
  step_index: number;
  rule_id: string;
  focus_path: number[];
  before_hash: string;
  after_hash: string;
  premises: string[];
}

/**
 * Pass end event
 */
export interface PassEndEvent extends ProofEvent {
  kind: "nsg.rewrite.pass.end";
  pass_index: number;
  pass_name: string;
  total_rewrites: number;
  final_hash: string;
}

/**
 * Rewrite end event
 */
export interface RewriteEndEvent extends ProofEvent {
  kind: "nsg.rewrite.end";
  ast_root_hash: string;
  proof_chain_hash: string;
  total_passes: number;
  total_rewrites: number;
}

/**
 * Union of all proof event types
 */
export type ProofEventUnion =
  | RewriteStartEvent
  | PassStartEvent
  | RewriteStepEvent
  | PassEndEvent
  | RewriteEndEvent;

/**
 * Proof ledger: collects events in NDJSON order.
 */
export class ProofLedger {
  private events: ProofEventUnion[] = [];
  readonly run_id: string;

  constructor(run_id: string) {
    this.run_id = run_id;
  }

  /**
   * Emit a rewrite start event
   */
  emitRewriteStart(input_hash: string, policy_hash: string): void {
    this.events.push({
      kind: "nsg.rewrite.start",
      run_id: this.run_id,
      input_hash,
      policy_hash,
    } as RewriteStartEvent);
  }

  /**
   * Emit a pass start event
   */
  emitPassStart(pass_index: number, pass_name: string): void {
    this.events.push({
      kind: "nsg.rewrite.pass.start",
      run_id: this.run_id,
      pass_index,
      pass_name,
    } as PassStartEvent);
  }

  /**
   * Emit a rewrite step (only when AST changes)
   */
  emitRewriteStep(
    step_index: number,
    rule_id: string,
    focus_path: number[],
    before_hash: string,
    after_hash: string,
    premises: string[]
  ): void {
    this.events.push({
      kind: "nsg.rewrite.step",
      run_id: this.run_id,
      step_index,
      rule_id,
      focus_path,
      before_hash,
      after_hash,
      premises,
    } as RewriteStepEvent);
  }

  /**
   * Emit a pass end event
   */
  emitPassEnd(
    pass_index: number,
    pass_name: string,
    total_rewrites: number,
    final_hash: string
  ): void {
    this.events.push({
      kind: "nsg.rewrite.pass.end",
      run_id: this.run_id,
      pass_index,
      pass_name,
      total_rewrites,
      final_hash,
    } as PassEndEvent);
  }

  /**
   * Emit rewrite end event
   */
  emitRewriteEnd(
    ast_root_hash: string,
    proof_chain_hash: string,
    total_passes: number,
    total_rewrites: number
  ): void {
    this.events.push({
      kind: "nsg.rewrite.end",
      run_id: this.run_id,
      ast_root_hash,
      proof_chain_hash,
      total_passes,
      total_rewrites,
    } as RewriteEndEvent);
  }

  /**
   * Export all events as NDJSON string
   */
  toNDJSON(): string {
    return this.events.map((e) => JSON.stringify(e)).join("\n");
  }

  /**
   * Export all events as array
   */
  toArray(): ProofEvent[] {
    return [...this.events];
  }

  /**
   * Clear events (for testing)
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get event count
   */
  get length(): number {
    return this.events.length;
  }
}

/**
 * Compute a deterministic run ID from input + policy hashes
 */
export function computeRunId(input_hash: string, policy_hash: string): string {
  return `${input_hash.substring(0, 8)}/${policy_hash.substring(0, 8)}`;
}
