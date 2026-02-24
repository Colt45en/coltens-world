#include "axis_cx/TimelineEngine.hpp"

#include <algorithm>
#include <cmath>
#include <chrono>
#include <stdexcept>

#include "axis_cx/AxisCodex.hpp"

namespace axis_cx {

namespace {

bool IsFinite(double v) { return std::isfinite(v); }

void SortObjectsStable(std::vector<VectorObject>& objects) {
  std::sort(objects.begin(), objects.end(), [](const VectorObject& a, const VectorObject& b) {
    return a.id < b.id;
  });
}

}  // namespace

void TimelineEngine::validateOrThrow(const TimelineConfig& config) {
  if (config.dt_seconds <= 0.0 || !IsFinite(config.dt_seconds)) {
    throw std::invalid_argument("TimelineConfig.dt_seconds must be finite and > 0");
  }
  if (config.snapshot_every_ticks == 0) {
    throw std::invalid_argument("TimelineConfig.snapshot_every_ticks must be > 0");
  }
  if (!IsCanonicalAxisCodex(config.axis_codex)) {
    throw std::invalid_argument("TimelineConfig.axis_codex must match canonical v1 labels");
  }
  const auto& h = config.heart;
  const double* heart_fields[] = {
      &h.base_resonance, &h.pulse_amplitude, &h.pulse_frequency_hz, &h.damping,
      &h.min_capacity_scale, &h.max_capacity_scale, &h.resonance_to_capacity_gain};
  for (const double* f : heart_fields) {
    if (!IsFinite(*f)) throw std::invalid_argument("HeartConfig contains non-finite value");
  }
  if (h.min_capacity_scale > h.max_capacity_scale) {
    throw std::invalid_argument("HeartConfig min_capacity_scale must be <= max_capacity_scale");
  }
  for (const auto& obj : config.initial_objects) {
    if (obj.id.empty()) throw std::invalid_argument("VectorObject.id must be non-empty");
    if (!IsFinite(obj.position.x) || !IsFinite(obj.position.y) || !IsFinite(obj.position.z) ||
        !IsFinite(obj.velocity.x) || !IsFinite(obj.velocity.y) || !IsFinite(obj.velocity.z) ||
        !IsFinite(obj.axis_bias.x) || !IsFinite(obj.axis_bias.y) || !IsFinite(obj.axis_bias.z) ||
        !IsFinite(obj.energy)) {
      throw std::invalid_argument("VectorObject contains non-finite numeric field");
    }
  }
}

void TimelineEngine::init(const TimelineConfig& config) {
  validateOrThrow(config);
  config_ = config;
  config_.axis_codex = CanonicalAxisCodex();
  objects_ = config_.initial_objects;
  SortObjectsStable(objects_);
  tick_log_.clear();
  snapshots_.clear();
  next_tick_ = 0;
  heart_.reset(config_.heart, config_.seed);
}

VectorObject TimelineEngine::StepObject(const VectorObject& obj, double dt, double heart_momentum) {
  if (!obj.active) return obj;

  VectorObject next = obj;
  const double drift_gain = Round6(0.05 * obj.energy * heart_momentum);
  next.velocity.x = Round6(obj.velocity.x + obj.axis_bias.x * drift_gain * dt);
  next.velocity.y = Round6(obj.velocity.y + obj.axis_bias.y * drift_gain * dt);
  next.velocity.z = Round6(obj.velocity.z + obj.axis_bias.z * drift_gain * dt);

  next.position.x = Round6(obj.position.x + next.velocity.x * dt);
  next.position.y = Round6(obj.position.y + next.velocity.y * dt);
  next.position.z = Round6(obj.position.z + next.velocity.z * dt);

  next.energy = Round6(std::max(0.0, obj.energy - 0.0025 * dt));
  next.active = next.energy > 0.000001;
  return next;
}

void TimelineEngine::maybeCaptureSnapshot(std::uint64_t tick, double sim_time_seconds) {
  if (tick % config_.snapshot_every_ticks != 0 && tick + 1 != config_.tick_count) return;
  std::vector<VectorObject> snapshot_objects = objects_;
  SortObjectsStable(snapshot_objects);
  snapshots_.push_back(TimelineSnapshot{tick, Round6(sim_time_seconds), heart_.state(), std::move(snapshot_objects)});
}

void TimelineEngine::step() {
  if (next_tick_ >= config_.tick_count) return;

  const std::uint64_t tick = next_tick_;
  heart_.step(config_.dt_seconds, tick);

  const std::uint32_t capacity_budget = static_cast<std::uint32_t>(std::max<long long>(
      0, std::llround(static_cast<double>(config_.base_capacity) * heart_.state().capacity_scale)));

  std::uint32_t processed = 0;
  std::uint32_t deferred = 0;
  for (auto& obj : objects_) {
    if (!obj.active) continue;
    if (processed < capacity_budget) {
      obj = StepObject(obj, config_.dt_seconds, heart_.state().momentum);
      ++processed;
    } else {
      ++deferred;
    }
  }

  const double sim_time_seconds = Round6(static_cast<double>(tick + 1) * config_.dt_seconds);
  tick_log_.push_back(TimelineTickRecord{
      tick, sim_time_seconds, heart_.state(), capacity_budget, processed, deferred});
  maybeCaptureSnapshot(tick, sim_time_seconds);
  next_tick_ += 1;
}

void TimelineEngine::run() {
  while (next_tick_ < config_.tick_count) {
    step();
  }
}

SimulationExport TimelineEngine::BuildExport() const {
  SimulationExport out;
  out.schema = "axis-codex-sim/v1";
  out.metadata.engine_name = "heart-timeline-engine";
  out.metadata.engine_version = "0.1.0";
  out.metadata.generated_by = "cpp";
  const auto now_ms =
      std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::system_clock::now().time_since_epoch())
          .count();
  out.metadata.generated_at_unix_ms = static_cast<std::uint64_t>(now_ms);
  out.metadata.deterministic_seed = config_.seed;
  out.config = config_;
  out.tick_log = tick_log_;
  out.snapshots = snapshots_;
  return out;
}

}  // namespace axis_cx
