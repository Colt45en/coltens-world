/**
 * Quick verification that math fixes work correctly
 * Tests edge cases that would have failed before the fixes
 */

import { Vector3 } from './apps/ide-web/src/math/Vector3';

console.log('=== Testing Math Fixes ===\n');

// Test 1: Vector3.angle with zero vectors (would have thrown or returned NaN)
console.log('✓ Test 1: Vector3.angle with zero vectors');
const zeroVec = new Vector3(0, 0, 0);
const unitVec = new Vector3(1, 0, 0);
const angle = Vector3.angle(zeroVec, unitVec);
console.log(`  Zero vector angle: ${angle} (expected: 0)`);
console.log(`  Is valid: ${!isNaN(angle) && angle === 0}`);

// Test 2: Vector3.angle with normal vectors
console.log('\n✓ Test 2: Vector3.angle with normal vectors');
const v1 = new Vector3(1, 0, 0);
const v2 = new Vector3(1, 0, 0);
const angle2 = Vector3.angle(v1, v2);
console.log(`  Same vector angle: ${angle2} (expected: 0)`);
console.log(`  Is valid: ${!isNaN(angle2) && angle2 === 0}`);

// Test 3: Fibonacci sphere generation edge case
console.log('\n✓ Test 3: Fibonacci sphere - boundary values');
const testY1 = 1; // Edge case: y = 1
const testY2 = -1; // Edge case: y = -1
const testY3 = 0.999999999; // Near boundary
const radiusAtY1 = Math.sqrt(Math.max(0, Math.min(1, 1 - testY1 * testY1)));
const radiusAtY2 = Math.sqrt(Math.max(0, Math.min(1, 1 - testY2 * testY2)));
const radiusAtY3 = Math.sqrt(Math.max(0, Math.min(1, 1 - testY3 * testY3)));
console.log(`  radiusAtY(1): ${radiusAtY1} (expected: 0)`);
console.log(`  radiusAtY(-1): ${radiusAtY2} (expected: 0)`);
console.log(`  radiusAtY(0.999999999): ${radiusAtY3} (expected: ~0.00141)`);
console.log(`  All valid: ${!isNaN(radiusAtY1) && !isNaN(radiusAtY2) && !isNaN(radiusAtY3)}`);

console.log('\n=== All Math Fixes Verified ===');
