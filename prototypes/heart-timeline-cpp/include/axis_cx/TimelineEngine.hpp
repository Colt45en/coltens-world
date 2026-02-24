#pragma once

#include <cstddef>
#include <vector>

#include "axis_cx/Heart.hpp"
#include "axis_cx/Types.hpp"

namespace axis_cx {

class TimelineEngine {
 public:
  void init(const TimelineConfig& config);
  void run();
  void step();

  const std::vector<TimelineTickRecord>& tick_log() const { return tick_log_; }
  const std::vector<TimelineSnapshot>& snapshots() const { return snapshots_; }
  const TimelineConfig& config() const { return config_; }
  const std::vector<VectorObject>& objects() const { return objects_; }

  SimulationExport BuildExport() const;

 private:
  void validateOrThrow(const TimelineConfig& config);
  void maybeCaptureSnapshot(std::uint64_t tick, double sim_time_seconds);
  static VectorObject StepObject(const VectorObject& obj, double dt, double heart_momentum);

  TimelineConfig config_{};
  Heart heart_{};
  std::vector<VectorObject> objects_{};
  std::vector<TimelineTickRecord> tick_log_{};
  std::vector<TimelineSnapshot> snapshots_{};
  std::uint64_t next_tick_{0};
};

}  // namespace axis_cx
