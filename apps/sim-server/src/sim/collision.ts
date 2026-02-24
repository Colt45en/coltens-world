/**
 * Server-side collision validation
 * Ensures client predictions don't cheat by moving through walls
 */

import type { Vec3 } from "./world";

export type BoxCollider = {
    x: number;
    y: number;
    width: number;
    height: number;
};

const ENTITY_RADIUS = 15; // pixels, must match client radius

/**
 * Check if circular entity would collide with static box
 */
export function checkCircleBoxCollision(
    pos: Vec3,
    box: BoxCollider,
    radius: number = ENTITY_RADIUS
): boolean {
    // Find closest point on box to circle center
    const closestX = Math.max(box.x, Math.min(pos.x, box.x + box.width));
    const closestY = Math.max(box.y, Math.min(pos.y, box.y + box.height));

    // Distance from circle center to closest point
    const dx = pos.x - closestX;
    const dy = pos.y - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    return dist < radius;
}

/**
 * Check if position is valid (not colliding with world)
 */
export function isValidPosition(
    pos: Vec3,
    staticColliders: BoxCollider[],
    radius: number = ENTITY_RADIUS
): boolean {
    for (const box of staticColliders) {
        if (checkCircleBoxCollision(pos, box, radius)) {
            return false;
        }
    }
    return true;
}

/**
 * Validate and clamp move to prevent collision
 * Returns clamped position if it would collide
 */
export function validateMoveAgainstColliders(
    currentPos: Vec3,
    targetPos: Vec3,
    staticColliders: BoxCollider[],
    radius: number = ENTITY_RADIUS
): Vec3 {
    // If target is valid, use it
    if (isValidPosition(targetPos, staticColliders, radius)) {
        return targetPos;
    }

    // If target collides, try axis-aligned movement
    const moveX = { ...targetPos, x: currentPos.x };
    if (isValidPosition(moveX, staticColliders, radius)) {
        return moveX;
    }

    const moveY = { ...targetPos, y: currentPos.y };
    if (isValidPosition(moveY, staticColliders, radius)) {
        return moveY;
    }

    // Can't move, stay in place
    return currentPos;
}
