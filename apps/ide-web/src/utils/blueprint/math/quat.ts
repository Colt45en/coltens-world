// Math: Unit Quaternions for rotation (4 scalars vs 9 in matrix)
export type Quat = [number, number, number, number]; // [x, y, z, w]

export function qFromAxisAngle(axis: [number, number, number], angle: number): Quat {
  const halfAngle = angle * 0.5;
  const s = Math.sin(halfAngle);
  const len = Math.hypot(...axis) || 1;
  return [
    (axis[0] / len) * s,
    (axis[1] / len) * s,
    (axis[2] / len) * s,
    Math.cos(halfAngle),
  ];
}

export function qMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function qSlerp(a: Quat, b: Quat, t: number): Quat {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

  // If the dot product is negative, negate one quaternion to take the shorter path
  const sign = dot < 0 ? -1 : 1;
  dot = Math.abs(dot);

  let scale0: number, scale1: number;

  if (1 - dot > 1e-6) {
    const omega = Math.acos(dot);
    const sinOmega = Math.sin(omega);
    scale0 = Math.sin((1 - t) * omega) / sinOmega;
    scale1 = Math.sin(t * omega) / sinOmega * sign;
  } else {
    // Linear interpolation for very close quaternions
    scale0 = 1 - t;
    scale1 = t * sign;
  }

  return [
    scale0 * a[0] + scale1 * b[0],
    scale0 * a[1] + scale1 * b[1],
    scale0 * a[2] + scale1 * b[2],
    scale0 * a[3] + scale1 * b[3],
  ];
}

export function qNormalize(q: Quat): Quat {
  const len = Math.hypot(...q) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

export function qToEuler(q: Quat): [number, number, number] {
  const [x, y, z, w] = q;

  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (w * x + y * z);
  const cosr_cosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);

  // Pitch (y-axis rotation)
  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (w * z + x * y);
  const cosy_cosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  return [roll, pitch, yaw];
}
