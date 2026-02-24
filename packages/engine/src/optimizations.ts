/**
 * High-performance ECS ecosystem for World Engine 100k+
 * Re-exports: available at @world-engine/engine
 */

// Original core (keep for backward compat)
export * from './index';

// NEW: Optimized archetype-based ECS
export { Archetype, ArchetypeWorld, CommandBuffer, type ComponentDef, type ComponentId, type EntityId, type Mask } from './archetype-core';

// NEW: Spatial grid culling
export { cullArchetypesByFrustum, SpatialGrid, type AABB, type Vec3 } from './spatial-grid';
