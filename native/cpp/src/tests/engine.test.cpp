/**
 * ECS Engine Tests (placeholder)
 */

#include "engine/ecs.h"
#include <cassert>

int main() {
  // ECS world creation
  ECSWorld world;
  world.init();

  // Entity creation
  EntityId e1 = world.create_entity();
  EntityId e2 = world.create_entity();
  assert(world.entity_count() == 2);

  // World ticking (deterministic simulation)
  world.tick(0.016f);  // 16ms frame
  assert(world.entity_count() == 2);

  return 0;
}
