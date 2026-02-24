#include "telemetry_emit.hpp"
#include <iostream>

namespace telemetry {

Emitter::Emitter(const std::string& host, int port, const std::string& tenant_id)
    : host_(host), port_(port), tenant_id_(tenant_id), running_(true) {
    client_ = std::make_unique<httplib::Client>(host_, port);
    client_->set_connection_timeout(2);
    client_->set_read_timeout(2);

    worker_ = std::thread(&Emitter::worker_loop, this);
}

Emitter::~Emitter() {
    shutdown();
}

void Emitter::shutdown() {
    {
        std::unique_lock<std::mutex> lock(mutex_);
        running_ = false;
        cv_.notify_one();
    }
    if (worker_.joinable()) {
        worker_.join();
    }
}

std::string Emitter::iso_now() const {
    using namespace std::chrono;
    auto now = system_clock::now();
    auto t = system_clock::to_time_t(now);
    std::tm tm{};
#if defined(_WIN32)
    gmtime_s(&tm, &t);
#else
    gmtime_r(&t, &tm);
#endif
    char buf[64];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm);
    return buf;
}

std::string Emitter::uuid_like() const {
    static std::mt19937_64 rng{std::random_device{}()};
    std::ostringstream o;
    o << std::hex;
    for (int i = 0; i < 4; i++) o << (uint64_t)rng();
    return o.str();
}

bool Emitter::emit(const json& event) {
    std::unique_lock<std::mutex> lock(mutex_);
    queue_.push(event);
    cv_.notify_one();
    return true;
}

bool Emitter::emit(const std::string& topic, const json& data, const std::string& category) {
    json event = {
        {"id", uuid_like()},
        {"topic", topic},
        {"category", category},
        {"timestamp", iso_now()},
        {"data", data}
    };
    return emit(event);
}

void Emitter::emit_batch(const std::vector<json>& events) {
    std::unique_lock<std::mutex> lock(mutex_);
    for (const auto& e : events) {
        queue_.push(e);
    }
    cv_.notify_one();
}

void Emitter::worker_loop() {
    while (running_) {
        std::vector<json> batch;
        {
            std::unique_lock<std::mutex> lock(mutex_);
            cv_.wait_for(lock, std::chrono::milliseconds(100), [this]() {
                return !queue_.empty() || !running_;
            });

            while (!queue_.empty() && batch.size() < 50) {  // batch up to 50
                batch.push_back(queue_.front());
                queue_.pop();
            }
        }

        if (!batch.empty()) {
            if (!send_batch(batch)) {
                // On failure, could implement retry logic here
                std::cerr << "Failed to send telemetry batch" << std::endl;
            }
        }
    }

    // Send remaining on shutdown
    std::vector<json> remaining;
    {
        std::unique_lock<std::mutex> lock(mutex_);
        while (!queue_.empty()) {
            remaining.push_back(queue_.front());
            queue_.pop();
        }
    }
    if (!remaining.empty()) {
        send_batch(remaining);
    }
}

bool Emitter::send_batch(const std::vector<json>& batch) {
    for (const auto& event : batch) {
        std::string body = event.dump();
        std::string url = "/ingest?tenant_id=" + tenant_id_;
        auto res = client_->Post(url.c_str(), body, "application/json");
        if (!res || res->status < 200 || res->status >= 300) {
            return false;
        }
    }
    return true;
}

} // namespace telemetry
