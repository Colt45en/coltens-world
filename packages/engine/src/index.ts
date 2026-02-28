/**
 * Entity Component System (ECS) runtime
 * Deterministic simulation core for World Engine
 */

function makeEntityId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface Component {
  readonly id: string;
  [key: string]: unknown;
}

export interface Entity {
  readonly id: string;
  components: Map<string, Component>;
}

export interface System {
  readonly id: string;
  query?: string[];
  update(entities: Entity[], deltaMs: number): void;
}

export class ECSEngine {
  private readonly entities: Map<string, Entity> = new Map();
  private readonly systems: System[] = [];
  private readonly componentIndex: Map<string, Set<string>> = new Map();
  private tickId: number = 0;

  createEntity(id?: string): Entity {
    const entityId = id || `entity_${makeEntityId()}`;
    const entity: Entity = {
      id: entityId,
      components: new Map(),
    };
    this.entities.set(entityId, entity);
    return entity;
  }

  addComponent(entityId: string, component: Component): void {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);

    entity.components.set(component.id, component);

    // Update component index
    if (!this.componentIndex.has(component.id)) {
      this.componentIndex.set(component.id, new Set());
    }
    this.componentIndex.get(component.id)!.add(entityId);
  }

  removeComponent(entityId: string, componentId: string): void {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);

    entity.components.delete(componentId);
    this.componentIndex.get(componentId)?.delete(entityId);
  }

  removeEntity(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    entity.components.forEach((_, componentId) => {
      this.componentIndex.get(componentId)?.delete(entityId);
    });
    this.entities.delete(entityId);
  }

  registerSystem(system: System): void {
    this.systems.push(system);
  }

  tick(deltaMs: number): void {
    this.tickId++;

    // Run systems
    for (const system of this.systems) {
      if (!system.query) {
        system.update(Array.from(this.entities.values()), deltaMs);
      } else {
        // Filter entities that have all required components
        const matching = Array.from(this.entities.values()).filter(entity =>
          system.query!.every(componentId => entity.components.has(componentId))
        );
        system.update(matching, deltaMs);
      }
    }
  }

  getSnapshot() {
    return {
      tickId: this.tickId,
      entities: Array.from(this.entities.values()).map(entity => ({
        id: entity.id,
        components: Object.fromEntries(entity.components),
      })),
    };
  }

  getEntity(entityId: string): Entity | undefined {
    return this.entities.get(entityId);
  }

  getEntitiesByComponent(componentId: string): Entity[] {
    const entityIds = this.componentIndex.get(componentId) || new Set();
    return Array.from(entityIds).map(id => this.entities.get(id)!);
  }

  clear(): void {
    this.entities.clear();
    this.componentIndex.clear();
    this.tickId = 0;
  }
}

// Protocol contracts (v1: sim, ops)
export * from "./contracts/protocol/index.js";

// Bus envelope contracts (pipeline messaging)
export * from "./contracts/index.js";

// Representation learning contracts and gates
export * from "./contracts/representation/index.js";

// Contract validation utilities (requireSchema, exhaustive, etc.)
export * from "./contracts/util/exhaustive.js";
export * from "./contracts/util/require-schema.js";

// Formatting kernel (deterministic text normalization + sort keys)
export * from "./formatting/index.js";

// JSON value types & coercion (engine-owned, Prisma-independent)
export { coerceJsonValue, requireJsonObject, requireJsonValue } from "./runtime/json.js";
export type { JsonObject, JsonPrimitive, JsonValue } from "./runtime/json.js";

// Prediction & Reconciliation
export * from "./prediction.js";

// Learning (representation learning, trainable networks)
export * from "./learning/index.js";

// Deterministic game foundation (fixed tick runtime + hash chain)
export * from "./game-foundation/index.js";

// World Engine: Ring-based deterministic simulation
export { canonicalEqual, canonicalize, contentAddressedId, sha256Hex, stableStringify } from "./determinism/canon";
export type { Json } from "./determinism/canon";
export { createConceptExtractionPipeline } from "./pipelines/conceptExtraction";
export { WorldEngineRuntime } from "./world/runtime";
export type { Pipeline } from "./world/runtime";

// NSG v1.0: Natural Semantic Graphs (deterministic rewrite pipeline)
export type { ASTNode, Flow, Fuse, Group, Link, Query, RingApply, Seal, Split, Term } from "./nsg/nsg-ast";
export { infer } from "./nsg/nsg-infer";
export { normalize } from "./nsg/nsg-normalize";
export { parseNSG, parseSingleExpression } from "./nsg/nsg-parser";
export { ProofLedger } from "./nsg/nsg-proof-ledger";
export type { PassEndEvent, PassStartEvent, ProofEvent, ProofEventKind, RewriteEndEvent, RewriteStartEvent, RewriteStepEvent } from "./nsg/nsg-proof-ledger";
export { rewriteNsg, rewriteProgram } from "./nsg/nsg-rewrite-engine";
export type { RewritePolicy, RewriteResult } from "./nsg/nsg-rewrite-engine";
export { ringEval } from "./nsg/nsg-ring-eval";
export { proofChainHash, seal } from "./nsg/nsg-seal";

// Intent frameworks (Graphics, Renderer, Lexicon)
export type { RenderOutput, RendererConfig, RendererRequestV1 } from "./contracts/renderer-intent.v1";
export { GraphicsIntentToolkit, type ToolResult } from "./tools/graphics-intent-tools";

export default ECSEngine;
