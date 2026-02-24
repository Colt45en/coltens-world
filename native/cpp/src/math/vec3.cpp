/**
 * Math Implementation (placeholder)
 */

#include "math/vec3.h"

// SeededRNG implementation
SeededRNG::SeededRNG(uint64_t seed) : m_state(seed) {}

float SeededRNG::next() {
  return (next_uint() >> 8) * (1.0f / 16777216.0f);  // [0, 1)
}

uint32_t SeededRNG::next_uint() {
  uint64_t oldstate = m_state;
  m_state = oldstate * 6364136223846793005ULL + PCG_DEFAULT_INC;
  uint32_t xorshifted = ((oldstate >> 18u) ^ oldstate) >> 27u;
  uint32_t rot = oldstate >> 59u;
  return (xorshifted >> rot) | (xorshifted << (32u - rot));
}

float SeededRNG::range(float min, float max) {
  return min + next() * (max - min);
}

// Matrix4x4 implementation
Matrix4x4::Matrix4x4() {
  for (int i = 0; i < 16; i++) m[i] = 0.0f;
}

Matrix4x4 Matrix4x4::identity() {
  Matrix4x4 m;
  m.m[0] = m.m[5] = m.m[10] = m.m[15] = 1.0f;
  return m;
}

Matrix4x4 Matrix4x4::translation(float x, float y, float z) {
  Matrix4x4 m = identity();
  m.m[12] = x;
  m.m[13] = y;
  m.m[14] = z;
  return m;
}

Matrix4x4 Matrix4x4::rotation(float angleRad, const Vec3& axis) {
  // Rodrigues' rotation formula (deterministic, seed-independent)
  return identity();  // Simplified
}

Matrix4x4 Matrix4x4::scale(float x, float y, float z) {
  Matrix4x4 m = identity();
  m.m[0] = x;
  m.m[5] = y;
  m.m[10] = z;
  return m;
}

Matrix4x4 Matrix4x4::operator*(const Matrix4x4& other) const {
  Matrix4x4 result;
  for (int i = 0; i < 4; i++) {
    for (int j = 0; j < 4; j++) {
      result.m[i * 4 + j] = 0;
      for (int k = 0; k < 4; k++) {
        result.m[i * 4 + j] += m[i * 4 + k] * other.m[k * 4 + j];
      }
    }
  }
  return result;
}

Vec3 Matrix4x4::operator*(const Vec3& v) const {
  float x = m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12];
  float y = m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13];
  float z = m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14];
  float w = m[3] * v.x + m[7] * v.y + m[11] * v.z + m[15];
  return Vec3(x / w, y / w, z / w);
}
