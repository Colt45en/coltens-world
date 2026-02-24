#include <doctest/doctest.h>

#include <fstream>

#include "axis_cx/AxisCodex.hpp"
#include "axis_cx/JsonIO.hpp"
#include "axis_cx/TimelineEngine.hpp"

TEST_CASE("Example config parses and timeline exports schema v1") {
  const std::string cfg_path = std::string(AXIS_CX_SOURCE_DIR) + "/examples/example_config.json";
  auto cfg = axis_cx::ReadConfigFile(cfg_path);
  CHECK_EQ(cfg.axis_codex.x, "emergence");
  CHECK_EQ(cfg.axis_codex.y, "decision");
  CHECK_EQ(cfg.axis_codex.z, "time_memory");

  axis_cx::TimelineEngine engine;
  engine.init(cfg);
  engine.run();
  const auto exported = engine.BuildExport();
  CHECK_EQ(exported.schema, "axis-codex-sim/v1");
  CHECK_EQ(exported.metadata.engine_name, "heart-timeline-engine");
  CHECK_EQ(exported.tick_log.size(), cfg.tick_count);
  CHECK_GE(exported.snapshots.size(), 1u);
}
