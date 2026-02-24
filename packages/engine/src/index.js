/**
 * Entity Component System (ECS) runtime
 * Deterministic simulation core for World Engine
 */
function makeEntityId() {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
        return cryptoObj.randomUUID();
    }
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
export class ECSEngine {
    entities = new Map();
    systems = [];
    componentIndex = new Map();
    tickId = 0;
    createEntity(id) {
        const entityId = id || `entity_${makeEntityId()}`;
        const entity = {
            id: entityId,
            components: new Map(),
        };
        this.entities.set(entityId, entity);
        return entity;
    }
    addComponent(entityId, component) {
        const entity = this.entities.get(entityId);
        if (!entity)
            throw new Error(`Entity ${entityId} not found`);
        entity.components.set(component.id, component);
        // Update component index
        if (!this.componentIndex.has(component.id)) {
            this.componentIndex.set(component.id, new Set());
        }
        this.componentIndex.get(component.id).add(entityId);
    }
    removeComponent(entityId, componentId) {
        const entity = this.entities.get(entityId);
        if (!entity)
            throw new Error(`Entity ${entityId} not found`);
        entity.components.delete(componentId);
        this.componentIndex.get(componentId)?.delete(entityId);
    }
    removeEntity(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity)
            return;
        entity.components.forEach((_, componentId) => {
            this.componentIndex.get(componentId)?.delete(entityId);
        });
        this.entities.delete(entityId);
    }
    registerSystem(system) {
        this.systems.push(system);
    }
    tick(deltaMs) {
        this.tickId++;
        // Run systems
        for (const system of this.systems) {
            if (!system.query) {
                system.update(Array.from(this.entities.values()), deltaMs);
            }
            else {
                // Filter entities that have all required components
                const matching = Array.from(this.entities.values()).filter(entity => system.query.every(componentId => entity.components.has(componentId)));
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
    getEntity(entityId) {
        return this.entities.get(entityId);
    }
    getEntitiesByComponent(componentId) {
        const entityIds = this.componentIndex.get(componentId) || new Set();
        return Array.from(entityIds).map(id => this.entities.get(id));
    }
    clear() {
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
// JSON value types & coercion (engine-owned, Prisma-independent)
export { coerceJsonValue, requireJsonObject, requireJsonValue } from "./runtime/json.js";
// Prediction & Reconciliation
export * from "./prediction.js";
// Learning (representation learning, trainable networks)
export * from "./learning/index.js";
export default ECSEngine;
