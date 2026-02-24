# World Engine: Native C++ Build System

**Engine-grade, deterministic, cross-platform C++ compilation pipeline.**

## 🎯 Architecture

```
Canonical Specs (Python Pydantic + OpenAPI JSON)
           ↓ (contract-driven)
TypeScript Types (generated, @we/contracts)
           ↓ (Node.js call)
C++ Toolchain (CMake + Clang/MSVC)
           ↓ (deterministic compilation)
Native Binary (or WASM via Emscripten)
           ↓
Nucleus (Node.js) ← can FFI call or spawn
```

## 📋 Prerequisites

### All Platforms

- **CMake ≥ 3.20** ([cmake.org/download](https://cmake.org/download))
  ```bash
  cmake --version
  ```

### Linux / macOS

- **Clang/LLVM** (preferred for determinism)

  ```bash
  # macOS
  brew install llvm

  # Linux (Ubuntu/Debian)
  sudo apt-get install clang llvm
  ```

### Windows

- **Visual Studio 2022 or later** (for MSVC toolchain)
  - OR **LLVM/Clang for Windows** ([releases.llvm.org](https://releases.llvm.org))

## 🚀 Quick Start

### Display available presets

```bash
node tooling/cpp/build.js --list
```

### Configure (detect toolchain, generate build system)

```bash
node tooling/cpp/build.js --configure
# or:
cd native/cpp && cmake -S . -B build
```

### Build (default: Release with Clang)

```bash
node tooling/cpp/build.js
# or:
cd native/cpp && cmake --build build --parallel
```

### Debug build

```bash
node tooling/cpp/build.js --debug
# Output: native/cpp/build/debug/bin/world-engine-native
```

### Run tests

```bash
node tooling/cpp/build.js --test
# Compiles and runs all unit tests
```

### Clean build artifacts

```bash
node tooling/cpp/build.js --clean
```

### Diagnose environment

```bash
node tooling/cpp/build.js --diagnose
# Shows: CMake version, Clang version, preset selection, etc.
```

## 🏗️ Build Presets (CMakePresets.json)

Choose the appropriate preset for your platform:

| Preset          | Platform | Compiler    | Use Case                                  |
| --------------- | -------- | ----------- | ----------------------------------------- |
| `clang-linux`   | Linux    | Clang       | Production (deterministic, fast)          |
| `clang-darwin`  | macOS    | Clang       | Development / Production                  |
| `clang-windows` | Windows  | Clang-cl    | Development (if installed)                |
| `msvc-windows`  | Windows  | MSVC        | Production (native Windows)               |
| `debug`         | Any      | Auto-detect | Development (debug symbols, fast compile) |
| `wasm`          | Browser  | Emscripten  | Optional: compile to WebAssembly          |

Auto-selected per platform:

- **Linux** → `clang-linux`
- **macOS** → `clang-darwin`
- **Windows** → `clang-windows` (prefer Clang for determinism)

### Override preset

```bash
cd native/cpp
cmake -S . -B build --preset [preset-name]
cmake --build build --parallel
```

## 📁 Project Structure

```
native/cpp/
  CMakeLists.txt              # Main build configuration
  CMakePresets.json           # Reproducible build presets

  include/
    engine/
      ecs.h                   # Entity-Component-System (deterministic simulation)
    math/
      vec3.h                  # Physics primitives (Vec3, Matrix4x4, SeededRNG)

  src/
    main.cpp                  # Engine entry point
    engine/
      ecs.cpp                 # ECS implementation
      component_registry.cpp
      query.cpp
    math/
      vec3.cpp                # Vec3 & Matrix operations
      matrix.cpp
      rng.cpp                 # Seeded RNG (deterministic)
    tests/
      math.test.cpp           # Math suite tests
      engine.test.cpp         # ECS suite tests

  build/                       # Build artifacts (gitignored)
    release/
      bin/world-engine-native
    debug/
      bin/world-engine-native
    clang-linux/
      bin/world-engine-native
```

## 🔨 Build Options

### Optimize for speed (default)

```bash
cmake --build build --parallel --config Release
```

### Debug build (with symbols, no optimization)

```bash
cmake --build build --parallel --config Debug
```

### Verbose output (see all compiler commands)

```bash
cmake --build build --parallel --verbose
```

### Link-time optimization (LTO)

```bash
cmake -S . -B build -DCMAKE_INTERPROCEDURAL_OPTIMIZATION=ON
```

## ✅ Determinism Verification

### Same input → Same output (reproducible builds)

```bash
# Build 1
node tooling/cpp/build.js --clean
node tooling/cpp/build.js
sha256sum build/release/bin/world-engine-native

# Build 2 (should match checksum)
node tooling/cpp/build.js --clean
node tooling/cpp/build.js
sha256sum build/release/bin/world-engine-native
```

**Expected**: Identical SHA256 hashes (deterministic build)

### Seeded RNG determinism

```bash
# Test reproducibility
# Same seed → same sequence
# See: src/tests/math.test.cpp
node tooling/cpp/build.js --test
```

## 🌐 WASM Compilation (Optional Future Layer)

To compile C++ to WebAssembly (browser-runnable):

### Install Emscripten

```bash
# https://emscripten.org/docs/getting_started/downloads.html
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest
```

### Build to WASM

```bash
cd native/cpp
export EMSDK=~/emsdk  # Set to your Emscripten installation
cmake -S . -B build --preset wasm
cmake --build build --parallel
# Output: build/wasm/bin/world-engine-native.js + .wasm
```

### Use in TypeScript/browser

```typescript
// Load WASM module
import Module from "@we/native-wasm";
const { ecs_init, ecs_tick } = Module;

// Call C++ from JS
ecs_init();
ecs_tick(0.016); // 16ms frame
```

## 🔗 Integration with World Engine

### From Nucleus (Node.js orchestrator)

```typescript
import { spawn } from "child_process";

// Spawn C++ binary
const proc = spawn("./native/cpp/build/release/bin/world-engine-native");

proc.stdout.on("data", (data) => {
  console.log(`[C++] ${data}`);
});

proc.on("close", (code) => {
  console.log(`C++ process exited with code ${code}`);
});
```

### From Root Build System

```bash
# Build all (TS + C++ + Python)
pnpm build:all

# Or individually:
pnpm build:cpp          # Native binary
pnpm build:web          # HTML + TS (Vite)
pnpm build              # TS packages
```

## 🐛 Troubleshooting

### **Error: CMake not found**

```bash
# Install CMake
# https://cmake.org/download
# Then add to PATH
cmake --version
```

### **Error: Clang not found**

```bash
# Fallback to system C++ compiler (slower for determinism)
# Or install Clang:
brew install llvm          # macOS
sudo apt install clang     # Linux
```

### **Error: Compilation fails with unknown symbol**

```bash
# Try full rebuild
node tooling/cpp/build.js --clean && node tooling/cpp/build.js

# Or verbose output
cmake --build build/release --verbose
```

### **Error: Tests fail**

```bash
# Run with verbose output
cmake --build build/release --verbose
ctest --output-on-failure
```

### **WASM compilation fails**

```bash
# Ensure Emscripten is set up
source ~/emsdk/emsdk_env.sh
export EMSDK=~/emsdk
node tooling/cpp/build.js --list  # Should show 'wasm' preset
```

## 📊 Performance Profiling

### Build time

```bash
# Time the build pipeline
time node tooling/cpp/build.js
```

### Binary size

```bash
ls -lh build/release/bin/world-engine-native
# Typical: ~500KB (release) or ~5MB (debug with symbols)
```

### Runtime performance

```bash
# Build with profiling
cmake -S . -B build -DCMAKE_CXX_FLAGS="-g -O2 -pg"
./build/bin/world-engine-native
# Generates gmon.out
gprof ./build/bin/world-engine-native gmon.out
```

## 📚 Architecture Details

### ECS (Entity-Component-System)

The core simulation kernel is deterministic:

- **Entities**: unique identifiers (u64)
- **Components**: pure data (no virtual methods)
- **Systems**: iterate components in stable order
- **Property**: **Same seed → same execution sequence** (replay-safe)

See: `src/engine/ecs.cpp`

### Math Primitives

- **Vec3**: 3D vector with dot/cross/normalize
- **Matrix4x4**: Row-major 4×4 transformation matrices
- **SeededRNG**: PCG (Permuted Congruential Generator)
  - **Key property**: Same seed → identical sequence
  - Used for deterministic physics simulation

See: `src/math/vec3.cpp`

### Determinism Guarantees

1. **No uninitialized memory**: All components zero-initialized
2. **No undefined behavior**: Clang strict mode (`-Werror`)
3. **Reproducible RNG**: Seeded, no float precision issues
4. **Deterministic linking**: `-Wl,--undefined-version` on Linux
5. **No timing dependencies**: All operations deterministic

## 🔗 See Also

- [CMake Documentation](https://cmake.org/documentation/)
- [Clang Documentation](https://clang.llvm.org/)
- [ECS Pattern](https://en.wikipedia.org/wiki/Entity_component_system)
- [Emscripten Documentation](https://emscripten.org/docs/)
- [@we/contracts](../../packages/contracts/README.md) — Type-safe TS↔C++ boundaries
- [Root Build System](../../package.json) — `pnpm build:cpp`

## 📝 Summary

**Engine-grade C++ build system:**

- ✅ Deterministic, reproducible compilations (same input → same binary)
- ✅ Cross-platform (Linux, macOS, Windows)
- ✅ Optional WASM compilation (browser-runnable)
- ✅ Type-safe boundaries (Pydantic→OpenAPI→TS→C++ types)
- ✅ CI/CD ready (automated build orchestration)
- ✅ Performance-optimized (Clang, LTO, vectorization)
- ✅ Production-hardened (strict warnings, zero undefined behavior)

Ready for integration into the World Engine ecosystem.
