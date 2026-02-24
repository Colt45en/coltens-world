import { Matrix3, Matrix4 } from "./Matrix";

function assertClose(a: number, b: number, eps = 1e-6) {
  if (Math.abs(a - b) > eps) throw new Error(`Expected ${a} ~ ${b}`);
}

// Matrix3: identity -> translate(2,3) should map (1,1) -> (3,4)
{
  const m = new Matrix3().identity().translate(2, 3);
  const p = m.transformPoint([1, 1]);
  assertClose(p[0], 3);
  assertClose(p[1], 4);
}

// Matrix3: rotation 90deg CCW: (1,0) -> (0,1)
{
  const m = new Matrix3().makeRotation(Math.PI / 2);
  const p = m.transformPoint([1, 0]);
  assertClose(p[0], 0);
  assertClose(p[1], 1);
}

// Matrix4: translate(10,0,0) maps (1,2,3) -> (11,2,3)
{
  const m = new Matrix4().identity().translate(10, 0, 0);
  const p = m.transformPoint([1, 2, 3]);
  assertClose(p[0], 11);
  assertClose(p[1], 2);
  assertClose(p[2], 3);
}

// Matrix4 invert round-trip
{
  const m = new Matrix4().identity().translate(5, -2, 7).rotateZ(0.3).scale(2, 3, 4);
  const inv = m.clone().invert();
  const id = m.clone().multiply(inv);
  // check a few identity entries
  assertClose(id.elements[0], 1);
  assertClose(id.elements[5], 1);
  assertClose(id.elements[10], 1);
  assertClose(id.elements[15], 1);
  assertClose(id.elements[12], 0);
  assertClose(id.elements[13], 0);
  assertClose(id.elements[14], 0);
}

console.log("✅ matrix sanity tests passed");

// Matrix3 transformDirection (no translation)
{
  const m = new Matrix3().makeTranslation([10, 20]);
  const dir = m.transformDirection([1, 0]);
  assertClose(dir[0], 1);
  assertClose(dir[1], 0);
}
console.log("✅ Matrix3.transformDirection ignores translation");

// Matrix4 transformDirection (no translation, no divide)
{
  const m = new Matrix4().makeTranslation([100, 200, 300]);
  const dir = m.transformDirection([1, 0, 0]);
  assertClose(dir[0], 1);
  assertClose(dir[1], 0);
  assertClose(dir[2], 0);
}
console.log("✅ Matrix4.transformDirection ignores translation");

// Matrix4 transformDirection with scale
{
  const m = new Matrix4().makeScale([2, 3, 4]);
  const dir = m.transformDirection([1, 1, 1]);
  assertClose(dir[0], 2);
  assertClose(dir[1], 3);
  assertClose(dir[2], 4);
}
console.log("✅ Matrix4.transformDirection applies scale");

// Matrix4 lookAt
{
  const eye: [number, number, number] = [0, 0, 5];
  const target: [number, number, number] = [0, 0, 0];
  const up: [number, number, number] = [0, 1, 0];

  const view = new Matrix4().lookAt(eye, target, up);
  // Camera at +Z looking at origin, forward in view space is -Z
  const forward = view.transformDirection([0, 0, -1]);

  // Should transform roughly to -Z in world (some tolerance for cross products)
  if (Math.abs(forward[0]) > 0.1 || Math.abs(forward[1]) > 0.1) {
    throw new Error(`lookAt forward direction incorrect: ${forward}`);
  }
}
console.log("✅ Matrix4.lookAt camera positioning");

// Matrix4 compose/decompose (no rotation)
{
  const pos: [number, number, number] = [10, 20, 30];
  const quat: [number, number, number, number] = [0, 0, 0, 1]; // identity
  const scale: [number, number, number] = [2, 3, 4];

  const m = new Matrix4().compose(pos, quat, scale);
  const { position, quaternion, scale: outScale } = m.decompose();

  assertClose(position[0], pos[0]);
  assertClose(position[1], pos[1]);
  assertClose(position[2], pos[2]);
  assertClose(outScale[0], scale[0]);
  assertClose(outScale[1], scale[1]);
  assertClose(outScale[2], scale[2]);
  assertClose(quaternion[0], quat[0], 1e-4);
  assertClose(quaternion[1], quat[1], 1e-4);
  assertClose(quaternion[2], quat[2], 1e-4);
  assertClose(quaternion[3], quat[3], 1e-4);
}
console.log("✅ Matrix4.compose/decompose TRS round-trip");

// Matrix4 compose/decompose with rotation
{
  const quatY90: [number, number, number, number] = [
    0,
    Math.sin(Math.PI / 4),
    0,
    Math.cos(Math.PI / 4),
  ]; // 90° Y rotation

  const m = new Matrix4().compose([0, 0, 0], quatY90, [1, 1, 1]);
  const { quaternion } = m.decompose();

  assertClose(quaternion[0], quatY90[0], 1e-4);
  assertClose(quaternion[1], quatY90[1], 1e-4);
  assertClose(quaternion[2], quatY90[2], 1e-4);
  assertClose(quaternion[3], quatY90[3], 1e-4);
}
console.log("✅ Matrix4.compose/decompose with quaternion rotation");

// Matrix4 extractNormalMatrix (uniform scale)
{
  const m = new Matrix4().makeScale([2, 2, 2]);
  const normalMat = m.extractNormalMatrix();

  // (2I)^-1 = 0.5I, transpose = 0.5I
  assertClose(normalMat.elements[0], 0.5, 1e-5);
  assertClose(normalMat.elements[4], 0.5, 1e-5);
  assertClose(normalMat.elements[8], 0.5, 1e-5);
}
console.log("✅ Matrix4.extractNormalMatrix uniform scale");

// Matrix4 extractNormalMatrix (non-uniform scale)
{
  const m = new Matrix4().makeScale([2, 1, 1]);
  const normalMat = m.extractNormalMatrix();

  // diag(2,1,1)^-1 = diag(0.5,1,1), transpose = same
  assertClose(normalMat.elements[0], 0.5, 1e-5);
  assertClose(normalMat.elements[4], 1.0, 1e-5);
  assertClose(normalMat.elements[8], 1.0, 1e-5);
}
console.log("✅ Matrix4.extractNormalMatrix non-uniform scale");
