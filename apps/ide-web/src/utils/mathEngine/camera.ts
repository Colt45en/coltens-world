// Camera and transform utilities for World Engine
// Pitch/yaw/roll rotations, view matrices, look-at calculations

import type { Vec3 } from "./geometry3d";
import { Geometry3D } from "./geometry3d";

export interface CameraState {
  position: Vec3;
  yaw: number; // Rotation around Y axis (degrees)
  pitch: number; // Rotation around X axis (degrees)
  roll: number; // Rotation around Z axis (degrees)
  fov: number; // Field of view (degrees)
}

export class CameraSystem {
  static create(position: Vec3 = { x: 0, y: 0, z: 0 }, yaw: number = 0, pitch: number = 0, roll: number = 0, fov: number = 60): CameraState {
    return { position, yaw, pitch, roll, fov };
  }

  // Get forward direction vector from yaw and pitch
  static getForward(camera: CameraState): Vec3 {
    const yawRad = (camera.yaw * Math.PI) / 180;
    const pitchRad = (camera.pitch * Math.PI) / 180;

    return {
      x: Math.cos(pitchRad) * Math.sin(yawRad),
      y: Math.sin(pitchRad),
      z: Math.cos(pitchRad) * Math.cos(yawRad),
    };
  }

  // Get right direction vector
  static getRight(camera: CameraState): Vec3 {
    const forward = this.getForward(camera);
    const worldUp = { x: 0, y: 1, z: 0 };
    return Geometry3D.vec3.normalize(Geometry3D.vec3.cross(forward, worldUp));
  }

  // Get up direction vector
  static getUp(camera: CameraState): Vec3 {
    const forward = this.getForward(camera);
    const right = this.getRight(camera);
    return Geometry3D.vec3.cross(right, forward);
  }

  // Move camera in its local space
  static move(camera: CameraState, forward: number, right: number, up: number): CameraState {
    const forwardVec = Geometry3D.vec3.scale(this.getForward(camera), forward);
    const rightVec = Geometry3D.vec3.scale(this.getRight(camera), right);
    const upVec = Geometry3D.vec3.scale(this.getUp(camera), up);

    const newPos = Geometry3D.vec3.add(
      camera.position,
      Geometry3D.vec3.add(forwardVec, Geometry3D.vec3.add(rightVec, upVec))
    );

    return { ...camera, position: newPos };
  }

  // Rotate camera (add delta to angles)
  static rotate(camera: CameraState, deltaYaw: number, deltaPitch: number, deltaRoll: number = 0): CameraState {
    return {
      ...camera,
      yaw: (camera.yaw + deltaYaw) % 360,
      pitch: Math.max(-89, Math.min(89, camera.pitch + deltaPitch)),
      roll: (camera.roll + deltaRoll) % 360,
    };
  }

  // Look at a target point
  static lookAt(camera: CameraState, target: Vec3): CameraState {
    const direction = Geometry3D.vec3.normalize(Geometry3D.vec3.sub(target, camera.position));

    const yaw = Math.atan2(direction.x, direction.z) * (180 / Math.PI);
    const pitch = Math.asin(direction.y) * (180 / Math.PI);

    return { ...camera, yaw, pitch };
  }

  // Orbit around a target point
  static orbit(target: Vec3, distance: number, yaw: number, pitch: number): Vec3 {
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;

    return {
      x: target.x + distance * Math.cos(pitchRad) * Math.sin(yawRad),
      y: target.y + distance * Math.sin(pitchRad),
      z: target.z + distance * Math.cos(pitchRad) * Math.cos(yawRad),
    };
  }
}

// Matrix operations for 3D transforms
export class Matrix4 {
  data: Float32Array;

  constructor(data?: number[]) {
    this.data = new Float32Array(16);
    if (data) {
      this.data.set(data);
    } else {
      this.identity();
    }
  }

  identity(): void {
    this.data.fill(0);
    this.data[0] = 1;
    this.data[5] = 1;
    this.data[10] = 1;
    this.data[15] = 1;
  }

  // Create perspective projection matrix
  static perspective(fovDegrees: number, aspect: number, near: number, far: number): Matrix4 {
    const f = 1.0 / Math.tan((fovDegrees * Math.PI) / 360);
    const nf = 1 / (near - far);

    return new Matrix4([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  }

  // Create orthographic projection matrix
  static orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): Matrix4 {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    return new Matrix4([
      -2 * lr, 0, 0, 0,
      0, -2 * bt, 0, 0,
      0, 0, 2 * nf, 0,
      (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1,
    ]);
  }

  // Create look-at view matrix
  static lookAt(eye: Vec3, target: Vec3, up: Vec3): Matrix4 {
    const z = Geometry3D.vec3.normalize(Geometry3D.vec3.sub(eye, target));
    const x = Geometry3D.vec3.normalize(Geometry3D.vec3.cross(up, z));
    const y = Geometry3D.vec3.cross(z, x);

    return new Matrix4([
      x.x, y.x, z.x, 0,
      x.y, y.y, z.y, 0,
      x.z, y.z, z.z, 0,
      -Geometry3D.vec3.dot(x, eye), -Geometry3D.vec3.dot(y, eye), -Geometry3D.vec3.dot(z, eye), 1,
    ]);
  }

  // Create translation matrix
  static translation(tx: number, ty: number, tz: number): Matrix4 {
    return new Matrix4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      tx, ty, tz, 1,
    ]);
  }

  // Create rotation matrix around X axis
  static rotationX(angleDegrees: number): Matrix4 {
    const rad = (angleDegrees * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);

    return new Matrix4([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ]);
  }

  // Create rotation matrix around Y axis
  static rotationY(angleDegrees: number): Matrix4 {
    const rad = (angleDegrees * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);

    return new Matrix4([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ]);
  }

  // Create rotation matrix around Z axis
  static rotationZ(angleDegrees: number): Matrix4 {
    const rad = (angleDegrees * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);

    return new Matrix4([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  // Create scaling matrix
  static scaling(sx: number, sy: number, sz: number): Matrix4 {
    return new Matrix4([
      sx, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, sz, 0,
      0, 0, 0, 1,
    ]);
  }

  // Matrix multiplication
  multiply(other: Matrix4): Matrix4 {
    const result = new Matrix4();
    const a = this.data!;
    const b = other.data!;
    const r = result.data!;

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        r[i * 4 + j] =
          a[i * 4 + 0]! * b[0 * 4 + j]! +
          a[i * 4 + 1]! * b[1 * 4 + j]! +
          a[i * 4 + 2]! * b[2 * 4 + j]! +
          a[i * 4 + 3]! * b[3 * 4 + j]!;
      }
    }

    return result;
  }

  // Transform a point
  transformPoint(v: Vec3): Vec3 {
    const m = this.data!;
    const w = m[3]! * v.x + m[7]! * v.y + m[11]! * v.z + m[15]!;

    return {
      x: (m[0]! * v.x + m[4]! * v.y + m[8]! * v.z + m[12]!) / w,
      y: (m[1]! * v.x + m[5]! * v.y + m[9]! * v.z + m[13]!) / w,
      z: (m[2]! * v.x + m[6]! * v.y + m[10]! * v.z + m[14]!) / w,
    };
  }

  // Transform a direction (ignore translation)
  transformDirection(v: Vec3): Vec3 {
    const m = this.data!;
    return {
      x: m[0]! * v.x + m[4]! * v.y + m[8]! * v.z,
      y: m[1]! * v.x + m[5]! * v.y + m[9]! * v.z,
      z: m[2]! * v.x + m[6]! * v.y + m[10]! * v.z,
    };
  }
}

// Quaternion for smooth rotations
export class Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;

  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  // Create from Euler angles (yaw, pitch, roll in degrees)
  static fromEuler(yaw: number, pitch: number, roll: number): Quaternion {
    const yawRad = (yaw * Math.PI) / 180 / 2;
    const pitchRad = (pitch * Math.PI) / 180 / 2;
    const rollRad = (roll * Math.PI) / 180 / 2;

    const cy = Math.cos(yawRad);
    const sy = Math.sin(yawRad);
    const cp = Math.cos(pitchRad);
    const sp = Math.sin(pitchRad);
    const cr = Math.cos(rollRad);
    const sr = Math.sin(rollRad);

    return new Quaternion(
      sr * cp * cy - cr * sp * sy,
      cr * sp * cy + sr * cp * sy,
      cr * cp * sy - sr * sp * cy,
      cr * cp * cy + sr * sp * sy
    );
  }

  // Spherical linear interpolation
  static slerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
    let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

    // If dot < 0, negate b to take shorter path
    let b2 = b;
    if (dot < 0) {
      dot = -dot;
      b2 = new Quaternion(-b.x, -b.y, -b.z, -b.w);
    }

    const DOT_THRESHOLD = 0.9995;
    if (dot > DOT_THRESHOLD) {
      // Linear interpolation for close quaternions
      return new Quaternion(
        a.x + t * (b2.x - a.x),
        a.y + t * (b2.y - a.y),
        a.z + t * (b2.z - a.z),
        a.w + t * (b2.w - a.w)
      ).normalize();
    }

    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);

    const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
    const s1 = sinTheta / sinTheta0;

    return new Quaternion(
      s0 * a.x + s1 * b2.x,
      s0 * a.y + s1 * b2.y,
      s0 * a.z + s1 * b2.z,
      s0 * a.w + s1 * b2.w
    );
  }

  normalize(): Quaternion {
    const mag = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    if (mag < 1e-10) return new Quaternion();
    return new Quaternion(this.x / mag, this.y / mag, this.z / mag, this.w / mag);
  }
}
