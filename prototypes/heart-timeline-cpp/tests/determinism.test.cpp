#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>

#include "axis_cx/AxisCodex.hpp"
#include "axis_cx/JsonIO.hpp"
#include "axis_cx/TimelineEngine.hpp"

namespace {
axis_cx::TimelineConfig MakeConfig() {
  axis_cx::TimelineConfig c;
  c.tick_count = 32;
  c.dt_seconds = 0.05;
  c.snapshot_every_ticks = 4;
  c.base_capacity = 3;
  c.seed = 42;
  c.axis_codex = axis_cx::CanonicalAxisCodex();
  c.heart = {0.2, 0.75, 0.33, 0.45, 0.25, 2.0, 0.8};
  for (int i = 0; i < 8; ++i) {
    axis_cx::VectorObject o;
    o.id = "node_" + std::to_string(i);
    o.position = {i * 0.1, i * 0.05, -i * 0.02};
    o.velocity = {0.01, 0.02, -0.01};
    o.axis_bias = {1.0, (i % 2 == 0 ? 0.5 : -0.5), 0.25};
    o.energy = 1.0 - i * 0.05;
    o.active = true;
    o.tags = {"seed"};
    c.initial_objects.push_back(o);
  }
  return c;
}
}  // namespace

TEST_CASE("Heart timeline deterministic comparable export is stable for same config") {
  axis_cx::TimelineEngine a;
  axis_cx::TimelineEngine b;
  const auto cfg = MakeConfig();
  a.init(cfg);
  b.init(cfg);
  a.run();
  b.run();
  const auto ja = axis_cx::ToDeterminismComparableJson(a.BuildExport());
  const auto jb = axis_cx::ToDeterminismComparableJson(b.BuildExport());
  CHECK_EQ(ja, jb);
}

TEST_CASE("Capacity budget bounds and enforcement") {
  axis_cx::TimelineEngine e;
  e.init(MakeConfig());
  e.run();
  for (const auto& t : e.tick_log()) {
    CHECK_GE(t.capacity_budget, 0u);
    CHECK_LE(t.processed_objects, t.capacity_budget);
  }
}
