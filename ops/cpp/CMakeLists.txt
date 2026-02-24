cmake_minimum_required(VERSION 3.16)
project(keeper_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(nlohmann_json)

FetchContent_Declare(
  httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG v0.15.3
)
FetchContent_MakeAvailable(httplib)

add_executable(engine
  main.cpp
  TelemetryClient.cpp
)

target_include_directories(engine PRIVATE ${httplib_SOURCE_DIR})
target_link_libraries(engine PRIVATE nlohmann_json::nlohmann_json)
