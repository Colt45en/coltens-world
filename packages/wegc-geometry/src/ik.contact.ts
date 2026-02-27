/**
 * IK Goal & Contact System
 * Gear-aware IK weighting, contact redirection, and multi-contact support
 */

import type {
  AvatarGeometryState,
  GearEnvelope,
  IKGoal,
  JointName,
  MultiContact,
  Vec3
} from "./contract.types.js";

/**
 * Maximum redirect distance per goal type
 */
const MAX_REDIRECT_DISTANCE: Record<IKGoal["type"], number> = {
  foot: 0.3,
  hand: 0.25,
  style_point: 0.15,
};

/**
 * Tier-based minimum weights
 */
const TIER_WEIGHTS: Record<IKGoal["type"], number> = {
  foot: 0.8,
  hand: 0.6,
  style_point: 0.4,
};

/**
 * Signed distance from point to gear envelope
 * Negative = inside, positive = outside
 */
export function signedDistance(point: Vec3, envelope: GearEnvelope): number {
  const local = worldToLocal(point, envelope);

  if (envelope.type === "OBB") {
    const dx = Math.max(0, Math.abs(local.x) - envelope.half_extents.x);
    const dy = Math.max(0, Math.abs(local.y) - envelope.half_extents.y);
    const dz = Math.max(0, Math.abs(local.z) - envelope.half_extents.z);
    const outside = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Inside distance
    if (outside === 0) {
      const dx_in = envelope.half_extents.x - Math.abs(local.x);
      const dy_in = envelope.half_extents.y - Math.abs(local.y);
      const dz_in = envelope.half_extents.z - Math.abs(local.z);
      const minDist = Math.min(dx_in, dy_in, dz_in);
      return -minDist;
    }

    return outside;
  } else if (envelope.type === "Capsule") {
    const from = envelope.local_from;
    const to = envelope.local_to;
    const closest = closestPointOnSegment(local, from, to);
    const r = envelope.half_extents.x; // Radius stored here

    const dx = local.x - closest.x;
    const dy = local.y - closest.y;
    const dz = local.z - closest.z;
    const distToAxis = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return distToAxis - r;
  }

  return 0;
}

/**
 * Closest point on line segment to a point
 */
function closestPointOnSegment(p: Vec3, a: Vec3, b: Vec3): Vec3 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len2 = dx * dx + dy * dy + dz * dz;

  if (len2 === 0) return a;

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / len2));

  return {
    x: a.x + t * dx,
    y: a.y + t * dy,
    z: a.z + t * dz,
  };
}

/**
 * Transform world point to local (OBB/Capsule) space
 */
function worldToLocal(point: Vec3, envelope: GearEnvelope): Vec3 {
  const offset = {
    x: point.x - envelope.local_from.x,
    y: point.y - envelope.local_from.y,
    z: point.z - envelope.local_from.z,
  };

  // Inverse rotation quaternion
  const q_inv = quatInverse(envelope.rotation);
  return rotateVec(offset, q_inv);
}

/**
 * Inverse quaternion
 */
function quatInverse(q: { x: number; y: number; z: number; w: number }): {
  x: number;
  y: number;
  z: number;
  w: number;
} {
  const len2 = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
  return { x: -q.x / len2, y: -q.y / len2, z: -q.z / len2, w: q.w / len2 };
}

/**
 * Rotate vector by quaternion
 */
function rotateVec(v: Vec3, q: { x: number; y: number; z: number; w: number }): Vec3 {
  const x = v.x,
    y = v.y,
    z = v.z;
  const qx = q.x,
    qy = q.y,
    qz = q.z,
    qw = q.w;

  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

/**
 * Calculate aggregated risk for IK goal from gear envelopes
 */
export function calculateGoalRisk(goal: IKGoal, envelopes: GearEnvelope[]): number {
  let riskSum = 0;

  for (const envelope of envelopes) {
    const dist = signedDistance(goal.target_position, envelope);
    if (dist < 0) {
      // Inside envelope
      const normalizedPenetration = Math.abs(dist) / envelope.risk_threshold;
      riskSum += Math.min(1, normalizedPenetration);
    }
  }

  return Math.min(1, riskSum);
}

/**
 * Modulate IK weight based on goal risk
 */
export function modulateIKWeight(
  baseWeight: number,
  goalRisk: number,
  riskExponent: number = 2
): number {
  return baseWeight * Math.pow(1 - goalRisk, riskExponent);
}

/**
 * Redirect IK goal if blocked by envelopes
 */
export function redirectGoal(
  goal: IKGoal,
  envelopes: GearEnvelope[],
  state: AvatarGeometryState
): { redirected: boolean; new_target: Vec3 } {
  const maxDist = MAX_REDIRECT_DISTANCE[goal.type];
  let blocked = false;

  for (const envelope of envelopes) {
    const dist = signedDistance(goal.target_position, envelope);
    if (dist < 0) {
      blocked = true;
      break;
    }
  }

  if (!blocked) {
    return { redirected: false, new_target: goal.target_position };
  }

  // Find nearest surface projection
  let nearestDist = Infinity;
  let nearestPoint = goal.target_position;

  for (const envelope of envelopes) {
    const candidate = projectToEnvelopeSurface(goal.target_position, envelope);
    const dist = vecDistance(candidate, goal.target_position);

    if (dist < nearestDist && dist <= maxDist) {
      nearestDist = dist;
      nearestPoint = candidate;
    }
  }

  return {
    redirected: nearestDist <= maxDist,
    new_target: nearestPoint,
  };
}

/**
 * Project point to nearest surface of envelope
 */
function projectToEnvelopeSurface(point: Vec3, envelope: GearEnvelope): Vec3 {
  const local = worldToLocal(point, envelope);
  let projectedLocal: Vec3;

  if (envelope.type === "OBB") {
    projectedLocal = {
      x: Math.max(-envelope.half_extents.x, Math.min(envelope.half_extents.x, local.x)),
      y: Math.max(-envelope.half_extents.y, Math.min(envelope.half_extents.y, local.y)),
      z: Math.max(-envelope.half_extents.z, Math.min(envelope.half_extents.z, local.z)),
    };
  } else {
    const closest = closestPointOnSegment(local, envelope.local_from, envelope.local_to);
    const r = envelope.half_extents.x;
    const dx = local.x - closest.x;
    const dy = local.y - closest.y;
    const dz = local.z - closest.z;
    const norm = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (norm > 0.0001) {
      projectedLocal = {
        x: closest.x + (dx / norm) * r,
        y: closest.y + (dy / norm) * r,
        z: closest.z + (dz / norm) * r,
      };
    } else {
      projectedLocal = closest;
    }
  }

  // Transform back to world
  const worldPoint = rotateVec(projectedLocal, envelope.rotation);
  return {
    x: worldPoint.x + envelope.local_from.x,
    y: worldPoint.y + envelope.local_from.y,
    z: worldPoint.z + envelope.local_from.z,
  };
}

/**
 * Vector distance
 */
function vecDistance(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Initialize multi-contact channel
 */
export function initializeMultiContact(limb: JointName, engage_threshold: number = 0.05): MultiContact {
  return {
    limb,
    channels: new Map(),
    stick_state: "released",
    engage_threshold,
    release_threshold: engage_threshold * 1.5,
    surface_patch_stack: [],
    weight_budget: 1.0,
  };
}

/**
 * Update multi-contact with hysteresis
 */
export function updateMultiContactState(
  contact: MultiContact,
  penetration: number
): MultiContact {
  const newContact = { ...contact };

  if (contact.stick_state === "released" && penetration < contact.engage_threshold) {
    newContact.stick_state = "engaged";
  } else if (contact.stick_state === "engaged" && penetration > contact.release_threshold) {
    newContact.stick_state = "released";
  }

  return newContact;
}
