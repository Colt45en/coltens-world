export function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
}

/**
 * v1 movement validation:
 * - input move vector clamped to [-1, 1]
 * - speed capped
 */
export function validateMove(move: { x: number; y: number }) {
    return {
        x: clamp(move.x, -1, 1),
        y: clamp(move.y, -1, 1),
    };
}
