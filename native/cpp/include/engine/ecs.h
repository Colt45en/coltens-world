#pragma once

/**
 * ECS (Entity Component System) - Engine-Grade Deterministic Simulation
 *
 * Core architectural principle:
 * - Entities: unique identifiers (u64)
 * - Components: pure data (no methods)
 * - Systems: deterministic operations that query components
 * - Deterministic: same seed → same sequence of operations
 */

#include <cstdint>
#include <vector>
#include <unordered_map>

using EntityId = uint64_t;

/**
 * ECS World: manages entities, components, systems
 */
class ECSWorld {
public:
  ECSWorld() = default;
  ~ECSWorld() = default;

  // Initialize world
  void init();

  // Main simulation loop (deterministic given seed)
  void tick(float dt);

  // Entity management
  EntityId create_entity();
  void destroy_entity(EntityId id);

  // Component queries (archetype-based)
  template<typename T>
  std::vector<EntityId> query() const;

  // Introspection
  size_t entity_count() const { return m_entities.size(); }
  size_t system_count() const { return m_systems.size(); }

private:
  std::vector<EntityId> m_entities;
  std::unordered_map<EntityId, std::vector<void*>> m_components;
  std::vector<void*> m_systems;
};
