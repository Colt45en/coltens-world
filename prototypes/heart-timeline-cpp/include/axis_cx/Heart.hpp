#pragma once

#include <cstdint>

#include "axis_cx/Types.hpp"

namespace axis_cx {

class Heart {
 public:
  void reset(const HeartConfig& config, std::uint64_t seed);
  void step(double dt, std::uint64_t tick_index);
  const HeartState& state() const { return state_; }
  const HeartConfig& config() const { return config_; }

 private:
  HeartConfig config_{};
  HeartState state_{};
  std::uint64_t seed_{0};
};

}  // namespace axis_cx
