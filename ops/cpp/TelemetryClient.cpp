#include "TelemetryClient.hpp"
#include "httplib.h"
#include <chrono>

TelemetryClient::TelemetryClient(Config cfg) : cfg_(std::move(cfg)) {
  th_ = std::thread([this]{ loop(); });
}

TelemetryClient::~TelemetryClient() {
  stop_.store(true);
  cv_.notify_all();
  if (th_.joinable()) th_.join();
}

void TelemetryClient::emit(nlohmann::json envelope) {
  std::unique_lock<std::mutex> lk(mu_);
  if (q_.size() >= cfg_.maxQueue) {
    // drop newest
    dropped_++;
    return;
  }
  q_.push_back(std::move(envelope));
  lk.unlock();
  cv_.notify_one();
}

size_t TelemetryClient::queued() {
  std::lock_guard<std::mutex> lk(mu_);
  return q_.size();
}

void TelemetryClient::loop() {
  httplib::Client cli(cfg_.host, cfg_.port);
  cli.set_connection_timeout(2);
  cli.set_read_timeout(2);
  cli.set_write_timeout(2);

  auto nextFlush = std::chrono::steady_clock::now();

  while (!stop_.load()) {
    std::deque<nlohmann::json> batch;

    {
      std::unique_lock<std::mutex> lk(mu_);
      cv_.wait_until(lk, nextFlush, [&]{
        return stop_.load() || (!q_.empty() && q_.size() >= cfg_.batchSize);
      });

      if (stop_.load()) break;

      const size_t n = std::min(cfg_.batchSize, q_.size());
      for (size_t i = 0; i < n; ++i) {
        batch.push_back(std::move(q_.front()));
        q_.pop_front();
      }
    }

    nextFlush = std::chrono::steady_clock::now() + std::chrono::milliseconds(cfg_.flushMs);

    if (batch.empty()) continue;

    nlohmann::json payload = nlohmann::json::array();
    for (auto &e : batch) payload.push_back(std::move(e));

    auto res = cli.Post(cfg_.path.c_str(), payload.dump(), "application/json");
    if (!res || res->status < 200 || res->status >= 300) {
      // If post fails, best-effort requeue (bounded)
      std::lock_guard<std::mutex> lk(mu_);
      while (!batch.empty() && q_.size() < cfg_.maxQueue) {
        q_.push_front(std::move(batch.back()));
        batch.pop_back();
      }
      if (!batch.empty()) dropped_ += batch.size(); // couldn't requeue remainder
    }
  }
}
