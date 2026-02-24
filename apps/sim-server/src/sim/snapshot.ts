import type { World } from "./world";

export function toSnapshot(world: World) {
    return {
        tick: world.tick,
        serverTime: Date.now(),
        entities: Array.from(world.entities.values()).map((e) => ({
            id: e.id,
            pos: e.pos,
            vel: e.vel,
            hp: e.hp,
        })),
    };
}
