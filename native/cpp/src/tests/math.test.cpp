/**
 * Math Tests (placeholder)
 */

#include "math/vec3.h"
#include <cassert>

int main() {
  // Vec3 tests
  Vec3 a = {1.0f, 2.0f, 3.0f};
  Vec3 b = {4.0f, 5.0f, 6.0f};
  Vec3 c = a + b;
  assert(c.x == 5.0f && c.y == 7.0f && c.z == 9.0f);

  // RNG determinism test
  SeededRNG rng1(12345);
  SeededRNG rng2(12345);
  for (int i = 0; i < 100; i++) {
    float v1 = rng1.next();
    float v2 = rng2.next();
    assert(v1 == v2);  // Same seed → same sequence
  }

  return 0;
}
