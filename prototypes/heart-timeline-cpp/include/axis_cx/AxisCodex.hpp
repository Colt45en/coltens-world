#pragma once

#include "axis_cx/Types.hpp"

namespace axis_cx {

inline AxisCodex CanonicalAxisCodex() {
  return AxisCodex{"emergence", "decision", "time_memory"};
}

inline bool IsCanonicalAxisCodex(const AxisCodex& c) {
  return c.x == "emergence" && c.y == "decision" && c.z == "time_memory";
}

}  // namespace axis_cx
