#include <iostream>
#include <stdexcept>
#include <string>

#include "axis_cx/JsonIO.hpp"
#include "axis_cx/TimelineEngine.hpp"

namespace {

std::string ArgValue(int argc, char** argv, const std::string& name, const std::string& def = "") {
  for (int i = 1; i < argc - 1; ++i) {
    if (argv[i] == name) return argv[i + 1];
  }
  return def;
}

bool HasFlag(int argc, char** argv, const std::string& flag) {
  for (int i = 1; i < argc; ++i) {
    if (argv[i] == flag) return true;
  }
  return false;
}

}  // namespace

int main(int argc, char** argv) {
  try {
    const std::string config_path = ArgValue(argc, argv, "--config");
    const std::string out_path = ArgValue(argc, argv, "--out", "simulation_export.json");
    if (config_path.empty()) {
      std::cerr << "Usage: heart_timeline_cli --config <path> [--out simulation_export.json] [--ticks N] [--seed N] [--snapshot-every N] [--print-summary]\n";
      return 1;
    }

    axis_cx::TimelineConfig config = axis_cx::ReadConfigFile(config_path);
    if (const auto v = ArgValue(argc, argv, "--ticks"); !v.empty()) config.tick_count = std::stoull(v);
    if (const auto v = ArgValue(argc, argv, "--seed"); !v.empty()) config.seed = std::stoull(v);
    if (const auto v = ArgValue(argc, argv, "--snapshot-every"); !v.empty()) config.snapshot_every_ticks = std::stoull(v);

    axis_cx::TimelineEngine engine;
    engine.init(config);
    engine.run();
    axis_cx::SimulationExport out = engine.BuildExport();
    axis_cx::WriteSimulationExportFile(out, out_path);

    if (HasFlag(argc, argv, "--print-summary")) {
      std::cout << "ticks=" << out.tick_log.size()
                << " snapshots=" << out.snapshots.size()
                << " objects=" << out.config.initial_objects.size()
                << " seed=" << out.metadata.deterministic_seed << "\n";
    }
    return 0;
  } catch (const std::exception& ex) {
    std::cerr << "heart_timeline_cli error: " << ex.what() << "\n";
    return 1;
  }
}
