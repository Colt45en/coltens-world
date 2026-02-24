/**
 * ECS Implementation (placeholder, engine-grade pattern)
 */

#include "engine/ecs.h"

void ECSWorld::init() {
  // Initialize world state
}

void ECSWorld::tick(float dt) {
  // Execute all systems deterministically
  // Systems iterate over entities with specific component types
}

EntityId ECSWorld::create_entity() {
  EntityId id = m_entities.empty() ? 0 : m_entities.back() + 1;
  m_entities.push_back(id);
  return id;
}

void ECSWorld::destroy_entity(EntityId id) {
  auto it = std::find(m_entities.begin(), m_entities.end(), id);
  if (it != m_entities.end()) {
    m_entities.erase(it);
  }
}
