#include "axis_cx/Heart.hpp"

#include <cmath>

namespace axis_cx {

namespace {
constexpr double kPi = 3.14159265358979323846;
}

double Round6(double value) {
  return std::round(value * 1'000'000.0) / 1'000'000.0;
}

double Clamp(double value, double lo, double hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

void Heart::reset(const HeartConfig& config, std::uint64_t seed) {
  config_ = config;
  seed_ = seed;
  (void)seed_;  // reserved for future seeded modulation

  state_.resonance = Round6(config.base_resonance);
  state_.momentum = Round6(config.base_resonance);
  state_.capacity_scale = Round6(Clamp(
      1.0 + config.resonance_to_capacity_gain * state_.resonance,
      config.min_capacity_scale,
      config.max_capacity_scale));
  state_.pulse_count = 0;
}

void Heart::step(double dt, std::uint64_t tick_index) {
  const double t = dt * static_cast<double>(tick_index);
  const double resonance_raw =
      config_.base_resonance +
      config_.pulse_amplitude * std::sin(2.0 * kPi * config_.pulse_frequency_hz * t);

  const double damping = Clamp(config_.damping, 0.0, 1.0);
  const double momentum = state_.momentum + (resonance_raw - state_.momentum) * (1.0 - damping);
  const double resonance = resonance_raw * (1.0 - damping) + momentum * damping;
  const double capacity_scale = Clamp(
      1.0 + config_.resonance_to_capacity_gain * resonance,
      config_.min_capacity_scale,
      config_.max_capacity_scale);

  state_.resonance = Round6(resonance);
  state_.momentum = Round6(momentum);
  state_.capacity_scale = Round6(capacity_scale);
  state_.pulse_count += 1;
}

}  // namespace axis_cx
