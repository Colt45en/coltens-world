#include "axis_cx/JsonIO.hpp"

#include <fstream>
#include <sstream>
#include <stdexcept>

#include <nlohmann/json.hpp>

#include "axis_cx/AxisCodex.hpp"

namespace axis_cx {

using json = nlohmann::json;

namespace {

json ToJson(const Vec3& v) { return json::array({Round6(v.x), Round6(v.y), Round6(v.z)}); }

Vec3 ParseVec3(const json& j, const char* field_name) {
  if (!j.is_array() || j.size() != 3) throw std::invalid_argument(std::string(field_name) + " must be [x,y,z]");
  return Vec3{j.at(0).get<double>(), j.at(1).get<double>(), j.at(2).get<double>()};
}

json ToJson(const AxisCodex& c) {
  return json{{"x", c.x}, {"y", c.y}, {"z", c.z}};
}

AxisCodex ParseAxisCodex(const json& j) {
  if (!j.is_object()) throw std::invalid_argument("axis_codex must be object");
  AxisCodex c;
  c.x = j.at("x").get<std::string>();
  c.y = j.at("y").get<std::string>();
  c.z = j.at("z").get<std::string>();
  return c;
}

json ToJson(const HeartConfig& h) {
  return json{
      {"base_resonance", Round6(h.base_resonance)},
      {"pulse_amplitude", Round6(h.pulse_amplitude)},
      {"pulse_frequency_hz", Round6(h.pulse_frequency_hz)},
      {"damping", Round6(h.damping)},
      {"min_capacity_scale", Round6(h.min_capacity_scale)},
      {"max_capacity_scale", Round6(h.max_capacity_scale)},
      {"resonance_to_capacity_gain", Round6(h.resonance_to_capacity_gain)},
  };
}

HeartConfig ParseHeartConfig(const json& j) {
  if (!j.is_object()) throw std::invalid_argument("heart must be object");
  HeartConfig h;
  h.base_resonance = j.at("base_resonance").get<double>();
  h.pulse_amplitude = j.at("pulse_amplitude").get<double>();
  h.pulse_frequency_hz = j.at("pulse_frequency_hz").get<double>();
  h.damping = j.at("damping").get<double>();
  h.min_capacity_scale = j.at("min_capacity_scale").get<double>();
  h.max_capacity_scale = j.at("max_capacity_scale").get<double>();
  h.resonance_to_capacity_gain = j.at("resonance_to_capacity_gain").get<double>();
  return h;
}

json ToJson(const HeartState& h) {
  return json{
      {"resonance", Round6(h.resonance)},
      {"capacity_scale", Round6(h.capacity_scale)},
      {"momentum", Round6(h.momentum)},
      {"pulse_count", h.pulse_count},
  };
}

json ToJson(const VectorObject& o) {
  return json{
      {"id", o.id},
      {"position", ToJson(o.position)},
      {"velocity", ToJson(o.velocity)},
      {"axis_bias", ToJson(o.axis_bias)},
      {"energy", Round6(o.energy)},
      {"active", o.active},
      {"tags", o.tags},
  };
}

VectorObject ParseVectorObject(const json& j) {
  if (!j.is_object()) throw std::invalid_argument("initial_objects[] must be object");
  VectorObject o;
  o.id = j.at("id").get<std::string>();
  o.position = ParseVec3(j.at("position"), "position");
  o.velocity = ParseVec3(j.at("velocity"), "velocity");
  o.axis_bias = ParseVec3(j.at("axis_bias"), "axis_bias");
  o.energy = j.at("energy").get<double>();
  o.active = j.at("active").get<bool>();
  if (j.contains("tags")) o.tags = j.at("tags").get<std::vector<std::string>>();
  return o;
}

json ToJson(const TimelineConfig& c) {
  json objects = json::array();
  for (const auto& o : c.initial_objects) objects.push_back(ToJson(o));
  return json{
      {"tick_count", c.tick_count},
      {"dt_seconds", Round6(c.dt_seconds)},
      {"snapshot_every_ticks", c.snapshot_every_ticks},
      {"base_capacity", c.base_capacity},
      {"seed", c.seed},
      {"axis_codex", ToJson(c.axis_codex)},
      {"heart", ToJson(c.heart)},
      {"initial_objects", objects},
  };
}

TimelineConfig ParseTimelineConfig(const json& j) {
  if (!j.is_object()) throw std::invalid_argument("config must be object");
  TimelineConfig c;
  c.tick_count = j.at("tick_count").get<std::uint64_t>();
  c.dt_seconds = j.at("dt_seconds").get<double>();
  c.snapshot_every_ticks = j.at("snapshot_every_ticks").get<std::uint64_t>();
  c.base_capacity = j.at("base_capacity").get<std::uint32_t>();
  c.seed = j.at("seed").get<std::uint64_t>();
  c.axis_codex = j.contains("axis_codex") ? ParseAxisCodex(j.at("axis_codex")) : CanonicalAxisCodex();
  c.heart = ParseHeartConfig(j.at("heart"));
  for (const auto& obj : j.at("initial_objects")) c.initial_objects.push_back(ParseVectorObject(obj));
  return c;
}

json ToJson(const TimelineTickRecord& r) {
  return json{
      {"tick", r.tick},
      {"sim_time_seconds", Round6(r.sim_time_seconds)},
      {"heart", ToJson(r.heart)},
      {"capacity_budget", r.capacity_budget},
      {"processed_objects", r.processed_objects},
      {"deferred_objects", r.deferred_objects},
  };
}

json ToJson(const TimelineSnapshot& s) {
  json objects = json::array();
  for (const auto& o : s.objects) objects.push_back(ToJson(o));
  return json{
      {"tick", s.tick},
      {"sim_time_seconds", Round6(s.sim_time_seconds)},
      {"heart", ToJson(s.heart)},
      {"objects", objects},
  };
}

json ToJson(const SimulationExport& e) {
  json tick_log = json::array();
  for (const auto& r : e.tick_log) tick_log.push_back(ToJson(r));
  json snapshots = json::array();
  for (const auto& s : e.snapshots) snapshots.push_back(ToJson(s));
  return json{
      {"schema", e.schema},
      {"metadata",
       {
           {"engine_name", e.metadata.engine_name},
           {"engine_version", e.metadata.engine_version},
           {"generated_by", e.metadata.generated_by},
           {"generated_at_unix_ms", e.metadata.generated_at_unix_ms},
           {"deterministic_seed", e.metadata.deterministic_seed},
       }},
      {"config", ToJson(e.config)},
      {"tick_log", tick_log},
      {"snapshots", snapshots},
  };
}

}  // namespace

TimelineConfig ReadConfigFile(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  if (!in) throw std::runtime_error("Failed to open config file: " + path);
  json j;
  in >> j;
  return ParseTimelineConfig(j);
}

void WriteSimulationExportFile(const SimulationExport& simulation, const std::string& path) {
  std::ofstream out(path, std::ios::binary);
  if (!out) throw std::runtime_error("Failed to open output file: " + path);
  out << ToJsonString(simulation, true);
}

std::string ToJsonString(const SimulationExport& simulation, bool pretty) {
  json j = ToJson(simulation);
  return pretty ? j.dump(2) : j.dump();
}

std::string ToDeterminismComparableJson(const SimulationExport& simulation) {
  SimulationExport copy = simulation;
  copy.metadata.generated_at_unix_ms = 0;
  return ToJsonString(copy, false);
}

}  // namespace axis_cx
