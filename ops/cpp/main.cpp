#include "TelemetryClient.hpp"
#include "json.hpp"
#include <string>
#include <chrono>
#include <thread>

static std::string iso_now() {
  auto now = std::chrono::system_clock::now();
  auto time_t = std::chrono::system_clock::to_time_t(now);
  std::tm tm = *std::gmtime(&time_t);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &tm);
  auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;
  return std::string(buf) + "." + std::to_string(ms.count()) + "Z";
}

int main() {
  TelemetryClient::Config cfg;
  TelemetryClient telem(cfg);

  nlohmann::json finding = {
    {"id", "evt-123"},
    {"topic", "diamond.finding"},
    {"category", "audit"},
    {"timestamp", iso_now()},
    {"data", {
      {"finding_id", "PERF.NESTED_LOOP#engine.cpp:231"},
      {"title", "Nested Loops O(n^2)"},
      {"dimension", "performance"},
      {"severity", "high"},
      {"trade_off", "performance_vs_readability"},
      {"location", {{"file","engine.cpp"},{"line",231}}}
    }}
  };

  telem.emit(finding);
  // ...
  std::this_thread::sleep_for(std::chrono::seconds(1)); // let it flush
  return 0;
}
