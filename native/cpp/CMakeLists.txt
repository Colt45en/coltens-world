cmake_minimum_required(VERSION 3.20 FATAL_ERROR)

project(
  world-engine-native
  VERSION 0.1.0
  LANGUAGES CXX
  DESCRIPTION "World Engine: Native C++ Core (Clang/LLVM toolchain)"
)

# ============================================================================
# Compiler Configuration (Deterministic, Engine-Grade)
# ============================================================================

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Prefer Clang for deterministic builds and better diagnostics
if(NOT CMAKE_CXX_COMPILER AND NOT CMAKE_C_COMPILER)
  find_program(CLANG_CXX clang++)
  find_program(CLANG_C clang)
  if(CLANG_CXX AND CLANG_C)
    set(CMAKE_CXX_COMPILER ${CLANG_CXX})
    set(CMAKE_C_COMPILER ${CLANG_C})
    message(STATUS "Using Clang: ${CMAKE_CXX_COMPILER}")
  endif()
endif()

# ============================================================================
# Build Flags (Deterministic, Warnings-as-Errors)
# ============================================================================

if(MSVC)
  # Windows MSVC or Clang-cl
  add_compile_options(
    /W4             # Warning level 4
    /WX             # Treat warnings as errors
    /permissive-    # Strict standards conformance
    /std:c++latest  # Latest C++ standard
    /Zc:inline      # Inline unused functions
  )

  # Release: Optimize for size and determinism
  string(APPEND CMAKE_CXX_FLAGS_RELEASE " /O2 /Oi /Ot")
  add_link_options(/INCREMENTAL:NO)  # Deterministic linking
else()
  # Clang/GCC on Linux/macOS
  add_compile_options(
    -Wall
    -Wextra
    -Wpedantic
    -Werror           # Treat warnings as errors
    -Wno-unused-parameter  # Blanket allow unused params
    -fvisibility=hidden    # Deterministic symbol visibility
    -fvisibility-inlines-hidden
  )

  # Release: Optimize for reproducibility
  string(APPEND CMAKE_CXX_FLAGS_RELEASE " -O2 -fno-ident")

  # Reproducible linker output
  add_link_options(-Wl,--undefined-version)
endif()

# ============================================================================
# Output Directories (Deterministic Placement)
# ============================================================================

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib")

# Per-configuration subdirectories (Windows)
foreach(CONF ${CMAKE_CONFIGURATION_TYPES})
  string(TOUPPER ${CONF} CONF_UPPER)
  set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_${CONF_UPPER} "${CMAKE_BINARY_DIR}/bin/${CONF}")
  set(CMAKE_LIBRARY_OUTPUT_DIRECTORY_${CONF_UPPER} "${CMAKE_BINARY_DIR}/lib/${CONF}")
  set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY_${CONF_UPPER} "${CMAKE_BINARY_DIR}/lib/${CONF}")
endforeach()

# ============================================================================
# Core Libraries
# ============================================================================

# Math primitives (Vec3, Matrix, RNG seeded)
add_library(we_math STATIC
  src/math/vec3.cpp
  src/math/matrix.cpp
  src/math/rng.cpp
)
target_include_directories(we_math PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include")
set_target_properties(we_math PROPERTIES
  VERSION ${PROJECT_VERSION}
  SOVERSION 0
)

# Physics/Engine core (ECS simulation kernel)
add_library(we_engine STATIC
  src/engine/ecs.cpp
  src/engine/component_registry.cpp
  src/engine/query.cpp
)
target_include_directories(we_engine PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include")
target_link_libraries(we_engine PRIVATE we_math)

# ============================================================================
# Executables
# ============================================================================

# Main engine binary
add_executable(world-engine-native
  src/main.cpp
)
target_include_directories(world-engine-native PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/include")
target_link_libraries(world-engine-native PRIVATE we_engine we_math)

# ============================================================================
# Testing (optional: Catch2 or GoogleTest)
# ============================================================================

enable_testing()

# Unit tests (placeholder)
add_executable(world-engine-tests
  src/tests/math.test.cpp
  src/tests/engine.test.cpp
)
target_include_directories(world-engine-tests PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/include")
target_link_libraries(world-engine-tests PRIVATE we_engine we_math)

add_test(
  NAME WorldEngineTests
  COMMAND world-engine-tests
)

# ============================================================================
# Install Targets (for CI/production deployment)
# ============================================================================

install(
  TARGETS world-engine-native
  RUNTIME DESTINATION bin
  LIBRARY DESTINATION lib
  ARCHIVE DESTINATION lib
)

install(
  DIRECTORY include/
  DESTINATION include
  FILES_MATCHING PATTERN "*.h" PATTERN "*.hpp"
)

# ============================================================================
# Summary
# ============================================================================

message(STATUS "")
message(STATUS "World Engine Native Build Configuration")
message(STATUS "========================================")
message(STATUS "Project:        ${PROJECT_NAME} v${PROJECT_VERSION}")
message(STATUS "C++ Standard:   ${CMAKE_CXX_STANDARD}")
message(STATUS "Compiler:       ${CMAKE_CXX_COMPILER}")
message(STATUS "Build Type:     ${CMAKE_BUILD_TYPE}")
message(STATUS "Output Dir:     ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}")
message(STATUS "WASM Support:   ${ENABLE_WASM}")
message(STATUS "")
