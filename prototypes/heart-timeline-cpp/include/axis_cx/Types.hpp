#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace axis_cx {

struct Vec3 {
  double x{0.0};
  double y{0.0};
  double z{0.0};
};

struct AxisCodex {
  std::string x{"emergence"};
  std::string y{"decision"};
  std::string z{"time_memory"};
};

struct HeartConfig {
  double base_resonance{0.0};
  double pulse_amplitude{0.0};
  double pulse_frequency_hz{0.0};
  double damping{0.0};
  double min_capacity_scale{0.25};
  double max_capacity_scale{2.0};
  double resonance_to_capacity_gain{1.0};
};

struct HeartState {
  double resonance{0.0};
  double capacity_scale{1.0};
  double momentum{0.0};
  std::uint64_t pulse_count{0};
};

struct VectorObject {
  std::string id;
  Vec3 position{};
  Vec3 velocity{};
  Vec3 axis_bias{};
  double energy{1.0};
  bool active{true};
  std::vector<std::string> tags{};
};

struct TimelineConfig {
  std::uint64_t tick_count{0};
  double dt_seconds{0.05};
  std::uint64_t snapshot_every_ticks{1};
  std::uint32_t base_capacity{0};
  std::uint64_t seed{0};
  AxisCodex axis_codex{};
  HeartConfig heart{};
  std::vector<VectorObject> initial_objects{};
};

struct TimelineTickRecord {
  std::uint64_t tick{0};
  double sim_time_seconds{0.0};
  HeartState heart{};
  std::uint32_t capacity_budget{0};
  std::uint32_t processed_objects{0};
  std::uint32_t deferred_objects{0};
};

struct TimelineSnapshot {
  std::uint64_t tick{0};
  double sim_time_seconds{0.0};
  HeartState heart{};
  std::vector<VectorObject> objects{};
};

struct SimulationMetadata {
  std::string engine_name{"heart-timeline-engine"};
  std::string engine_version{"0.1.0"};
  std::string generated_by{"cpp"};
  std::uint64_t generated_at_unix_ms{0};
  std::uint64_t deterministic_seed{0};
};

struct SimulationExport {
  std::string schema{"axis-codex-sim/v1"};
  SimulationMetadata metadata{};
  TimelineConfig config{};
  std::vector<TimelineTickRecord> tick_log{};
  std::vector<TimelineSnapshot> snapshots{};
};

double Round6(double value);
double Clamp(double value, double lo, double hi);

}  // namespace axis_cx
