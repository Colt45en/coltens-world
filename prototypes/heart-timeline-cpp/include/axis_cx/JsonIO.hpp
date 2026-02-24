#pragma once

#include <string>

#include "axis_cx/Types.hpp"

namespace axis_cx {

TimelineConfig ReadConfigFile(const std::string& path);
void WriteSimulationExportFile(const SimulationExport& simulation, const std::string& path);

std::string ToJsonString(const SimulationExport& simulation, bool pretty = true);
std::string ToDeterminismComparableJson(const SimulationExport& simulation);

}  // namespace axis_cx
