/**
 * Collision Detection & Response Engine
 * Handles circle-circle and circle-box collisions for gameplay
 */
/**
 * Detect circle-circle collision
 */
export function detectCircleCircle(a, b) {
    const dx = b.pos.x - a.pos.x;
    const dy = b.pos.y - a.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = a.radius + b.radius;
    if (dist < minDist) {
        const penetration = minDist - dist;
        const nx = dist > 0 ? dx / dist : 1;
        const ny = dist > 0 ? dy / dist : 0;
        return {
            entityId: a.pos, // Placeholder, will be set by caller
            otherId: b.pos,
            normal: { x: nx, y: ny },
            penetration
        };
    }
    return null;
}
/**
 * Detect circle-box collision (axis-aligned rectangles)
 * Returns collision info with normal pointing out of box
 */
export function detectCircleBox(circle, box) {
    // Find closest point on box to circle center
    const closestX = Math.max(box.x, Math.min(circle.pos.x, box.x + box.width));
    const closestY = Math.max(box.y, Math.min(circle.pos.y, box.y + box.height));
    // Distance to closest point
    const dx = circle.pos.x - closestX;
    const dy = circle.pos.y - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < circle.radius) {
        const penetration = circle.radius - dist;
        // Normal: direction from closest point to circle center
        const nx = dist > 0 ? dx / dist : 1;
        const ny = dist > 0 ? dy / dist : 0;
        return {
            entityId: circle.pos, // Placeholder
            normal: { x: nx, y: ny },
            penetration
        };
    }
    return null;
}
/**
 * Resolve collision by pushing circle out of obstacle
 * Modifies position in place
 */
export function resolveCollision(pos, normal, penetration) {
    // Push by penetration depth + small buffer to prevent re-collision
    const buffer = 0.5;
    pos.x += normal.x * (penetration + buffer);
    pos.y += normal.y * (penetration + buffer);
}
/**
 * Predict next position and check collisions
 * Returns predicted position and any collisions that would occur
 */
export function predictMove(currentPos, velocity, dt, radius, staticColliders, otherEntities) {
    const nextPos = {
        x: currentPos.x + velocity.x * dt,
        y: currentPos.y + velocity.y * dt
    };
    const testCircle = {
        type: 'circle',
        radius,
        pos: nextPos
    };
    const collisions = [];
    let canMove = true;
    // Check against static terrain
    for (const box of staticColliders) {
        const collision = detectCircleBox(testCircle, box);
        if (collision) {
            collisions.push(collision);
            canMove = false;
        }
    }
    // Check against other entities (for gameplay scripting, not blocking)
    if (otherEntities) {
        for (const [id, entity] of otherEntities) {
            const collision = detectCircleCircle(testCircle, entity);
            if (collision) {
                collision.otherId = id;
                collisions.push(collision);
                // Don't block on entity collision (handled by pushback)
            }
        }
    }
    return { nextPos, canMove, collisions };
}
/**
 * Sliding collision response: move as far as possible along desired direction
 * Useful for wall-sliding when player moves diagonally into corner
 */
export function slideAlongCollision(pos, velocity, collision) {
    // Push out by collision
    resolveCollision(pos, collision.normal, collision.penetration);
    // Calculate tangent to collision surface
    const tangentX = -collision.normal.y;
    const tangentY = collision.normal.x;
    // Project velocity onto tangent (remove component into wall)
    const dotProduct = velocity.x * tangentX + velocity.y * tangentY;
    const slideVel = {
        x: tangentX * dotProduct,
        y: tangentY * dotProduct
    };
    return {
        pos: { ...pos },
        velocity: slideVel
    };
}
