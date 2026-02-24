import type { World } from "./world";

export type TickConfig = {
    dt: number;
    maxSpeed: number;
    accel: number;
};

export const DefaultTickConfig: TickConfig = {
    dt: 1 / 20,
    maxSpeed: 6,
    accel: 40,
};

export function stepVelocity(
    current: number,
    target: number,
    accel: number,
    dt: number
) {
    const delta = target - current;
    const maxDelta = accel * dt;
    if (Math.abs(delta) <= maxDelta) return target;
    return current + Math.sign(delta) * maxDelta;
}

export function tickWorld(world: World, cfg: TickConfig) {
    for (const e of world.entities.values()) {
        e.pos.x += e.vel.x * cfg.dt;
        e.pos.z += e.vel.z * cfg.dt;
    }
    world.tick += 1;
}
