#!/usr/bin/env node
/**
 * cpp.build
 * Builds the World Engine native C++ components using CMake and Ninja.
 */

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const cppDir = path.join(__dirname, '..', '..', 'native', 'cpp');
const buildDir = path.join(cppDir, 'build');

console.log('[cpp.build] Starting C++ build...');

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Configure with CMake
console.log('[cpp.build] Configuring with CMake...');
try {
  execSync(`cmake -S "${cppDir}" -B "${buildDir}" -G Ninja`, { stdio: 'inherit' });
} catch (error) {
  console.error('[cpp.build] CMake configure failed:', error.message);
  process.exit(1);
}

// Build with Ninja
console.log('[cpp.build] Building with Ninja...');
try {
  execSync(`ninja -C "${buildDir}"`, { stdio: 'inherit' });
} catch (error) {
  console.error('[cpp.build] Ninja build failed:', error.message);
  process.exit(1);
}

console.log('[cpp.build] C++ build completed successfully.');
process.exit(0);
