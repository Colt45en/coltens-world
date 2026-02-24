#pragma once
#include <deque>
#include <mutex>
#include <condition_variable>
#include <thread>
#include <atomic>
#include <string>
#include "json.hpp"

class TelemetryClient {
public:
  struct Config {
    std::string host = "127.0.0.1";
    int port = 3000;
    std::string path = "/ingest/batch?tenant_id=00000000-0000-0000-0000-000000000000";
    size_t maxQueue = 5000;     // backpressure cap
    size_t batchSize = 200;     // batch per POST
    int flushMs = 200;          // flush interval
  };

  explicit TelemetryClient(Config cfg);
  ~TelemetryClient();

  // Non-blocking enqueue (drops newest if queue full)
  void emit(nlohmann::json envelope);

  // Optional: expose stats
  size_t dropped() const { return dropped_.load(); }
  size_t queued();

private:
  void loop();

  Config cfg_;
  std::mutex mu_;
  std::condition_variable cv_;
  std::deque<nlohmann::json> q_;
  std::thread th_;
  std::atomic<bool> stop_{false};
  std::atomic<size_t> dropped_{0};
};
