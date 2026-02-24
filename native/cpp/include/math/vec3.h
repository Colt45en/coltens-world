#pragma once

/**
 * Math Primitives: Vec3, Matrix, Seeded RNG
 *
 * Ensures:
 * - Deterministic results (same seed → same sequence)
 * - High precision (float64 for critical calculations)
 * - Fast vectorizable operations
 */

#include <cmath>

/**
 * 3D Vector (deterministic, no hidden state)
 */
struct Vec3 {
  float x, y, z;

  Vec3() : x(0), y(0), z(0) {}
  Vec3(float x, float y, float z) : x(x), y(y), z(z) {}

  // Deterministic arithmetic
  Vec3 operator+(const Vec3& v) const {
    return Vec3(x + v.x, y + v.y, z + v.z);
  }

  Vec3 operator-(const Vec3& v) const {
    return Vec3(x - v.x, y - v.y, z - v.z);
  }

  Vec3 operator*(float s) const {
    return Vec3(x * s, y * s, z * s);
  }

  // Dot product
  float dot(const Vec3& v) const {
    return x * v.x + y * v.y + z * v.z;
  }

  // Cross product
  Vec3 cross(const Vec3& v) const {
    return Vec3(
      y * v.z - z * v.y,
      z * v.x - x * v.z,
      x * v.y - y * v.x
    );
  }

  // Length (magnitude)
  float length() const {
    return std::sqrt(dot(*this));
  }

  // Normalized direction (deterministic if seed-based)
  Vec3 normalize() const {
    float len = length();
    if (len == 0.0f) return Vec3(0, 0, 0);
    return operator*(1.0f / len);
  }
};

/**
 * 4x4 Matrix (row-major, deterministic)
 */
struct Matrix4x4 {
  float m[16];

  Matrix4x4();

  static Matrix4x4 identity();
  static Matrix4x4 translation(float x, float y, float z);
  static Matrix4x4 rotation(float angleRad, const Vec3& axis);
  static Matrix4x4 scale(float x, float y, float z);

  Matrix4x4 operator*(const Matrix4x4& other) const;
  Vec3 operator*(const Vec3& v) const;
};

/**
 * Seeded Random Number Generator (deterministic)
 *
 * PCG (Permuted Congruential Generator): fast, portable, good distribution
 * Key property: Same seed → same sequence (replay-safe)
 */
class SeededRNG {
public:
  explicit SeededRNG(uint64_t seed = 0xDEADBEEF);

  // Next random value [0, 1)
  float next();

  // Next random integer
  uint32_t next_uint();

  // Random in range [min, max)
  float range(float min, float max);

private:
  uint64_t m_state;
  static constexpr uint64_t PCG_DEFAULT_INC = 1442695040888963407ULL;
};
