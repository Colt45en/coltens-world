#include <iostream>
#include "engine/ecs.h"
#include "math/vec3.h"

/**
 * World Engine: Native C++ Core
 *
 * This main.cpp demonstrates the engine-grade C++ architecture:
 * - ECS (Entity Component System) for deterministic simulation
 * - Math primitives (Vec3, Matrix) with seeded RNG
 * - Compiled to native binary (or WASM via Emscripten)
 *
 * Build:
 *   cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
 *   cmake --build build --parallel
 *   ./build/bin/world-engine-native
 */

int main(int argc, char* argv[]) {
  std::cout << "🚀 World Engine C++ Native Core\n";
  std::cout << "   Version: 0.1.0 (Engine-Grade)\n";
  std::cout << "   Compiler: " << COMPILER_NAME << "\n";
  std::cout << "   C++ Standard: C++" << __cplusplus << "\n";
  std::cout << "\n";

  // Example: Create math primitives
  std::cout << "📐 Math System:\n";
  Vec3 pos = {1.0f, 2.0f, 3.0f};
  Vec3 vel = {0.1f, 0.0f, 0.0f};
  std::cout << "   Position: (" << pos.x << ", " << pos.y << ", " << pos.z << ")\n";
  std::cout << "   Velocity: (" << vel.x << ", " << vel.y << ", " << vel.z << ")\n";

  // Example: Create ECS world
  std::cout << "\n🎮 ECS System:\n";
  ECSWorld world;
  world.init();
  std::cout << "   World initialized\n";
  std::cout << "   Entities: " << world.entity_count() << "\n";
  std::cout << "   Systems registered: " << world.system_count() << "\n";

  // Example: Tick simulation
  std::cout << "\n⏱️  Simulation:\n";
  for (int i = 0; i < 3; i++) {
    world.tick(0.016f);  // ~60 FPS
    std::cout << "   Tick " << (i + 1) << " (dt=16ms)\n";
  }

  std::cout << "\n✅ World Engine core operational\n";
  return 0;
}
