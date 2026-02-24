cmake_minimum_required(VERSION 3.20)
project(heart_timeline_cpp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

FetchContent_Declare(
  nlohmann_json
  URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz
)
FetchContent_Declare(
  doctest
  URL https://github.com/doctest/doctest/archive/refs/tags/v2.4.11.tar.gz
)
FetchContent_MakeAvailable(nlohmann_json doctest)

add_library(axis_cx
  src/Heart.cpp
  src/TimelineEngine.cpp
  src/JsonIO.cpp
)

target_include_directories(axis_cx PUBLIC include)
target_link_libraries(axis_cx PUBLIC nlohmann_json::nlohmann_json)

add_executable(heart_timeline_cli src/main.cpp)
target_link_libraries(heart_timeline_cli PRIVATE axis_cx)

enable_testing()

add_executable(heart_timeline_tests
  tests/determinism.test.cpp
  tests/schema_roundtrip.test.cpp
)
target_include_directories(heart_timeline_tests PRIVATE include)
target_link_libraries(heart_timeline_tests PRIVATE axis_cx doctest::doctest)
target_compile_definitions(heart_timeline_tests PRIVATE AXIS_CX_SOURCE_DIR="${CMAKE_CURRENT_SOURCE_DIR}")
add_test(NAME heart_timeline_tests COMMAND heart_timeline_tests)
