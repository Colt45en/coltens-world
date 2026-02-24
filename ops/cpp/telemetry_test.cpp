#include "telemetry_emit.hpp"
#include <iostream>
#include <thread>
#include <chrono>

int main() {
    telemetry::Emitter emitter("127.0.0.1", 3000);

    // Emit a diamond finding
    json finding_data = {
        {"finding_id", "PERF.NESTED_LOOP#engine.cpp:231"},
        {"title", "Nested Loops O(n^2)"},
        {"detail", "inner loop scans N each outer iteration"},
        {"dimension", "performance"},
        {"severity", "high"},
        {"trade_off", "performance_vs_readability"},
        {"location", {{"file", "engine.cpp"}, {"line", 231}}}
    };

    if (emitter.emit("diamond.finding", finding_data)) {
        std::cout << "Emitted diamond finding" << std::endl;
    } else {
        std::cout << "Failed to emit" << std::endl;
    }

    // Emit some recorder state
    emitter.emit("recorder.state", {
        {"phase", "analysis"},
        {"progress", 0.75},
        {"entropy", 0.42}
    });

    // Wait a bit for async sending
    std::this_thread::sleep_for(std::chrono::seconds(2));

    emitter.shutdown();
    return 0;
}
