#pragma once

#include <string>
#include <random>
#include <chrono>
#include <sstream>
#include <memory>
#include <thread>
#include <queue>
#include <mutex>
#include <condition_variable>
#include "httplib.h"
#include "json.hpp"

namespace telemetry {

using json = nlohmann::json;

class Emitter {
public:
    Emitter(const std::string& host = "127.0.0.1", int port = 3000, const std::string& tenant_id = "00000000-0000-0000-0000-000000000000");
    ~Emitter();

    // Emit a single event
    bool emit(const json& event);

    // Emit with custom topic/data
    bool emit(const std::string& topic, const json& data, const std::string& category = "audit");

    // Batch emit (for high throughput)
    void emit_batch(const std::vector<json>& events);

    // Shutdown (flush pending)
    void shutdown();

private:
    std::string iso_now() const;
    std::string uuid_like() const;

    std::string host_;
    int port_;
    std::string tenant_id_;
    std::unique_ptr<httplib::Client> client_;

    // Async batching
    std::thread worker_;
    std::queue<json> queue_;
    std::mutex mutex_;
    std::condition_variable cv_;
    bool running_;
    std::vector<json> batch_;

    void worker_loop();
    bool send_batch(const std::vector<json>& batch);
};

} // namespace telemetry
