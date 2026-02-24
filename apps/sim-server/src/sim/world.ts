export type EntityId = string;

export type Vec3 = { x: number; y: number; z: number };

export type Entity = {
    id: EntityId;
    pos: Vec3;
    vel: Vec3;
    hp: number;
};

export type World = {
    tick: number;
    entities: Map<EntityId, Entity>;
};

export function createWorld(): World {
    return { tick: 0, entities: new Map() };
}

export function ensurePlayer(world: World, playerId: string): Entity {
    let e = world.entities.get(playerId);
    if (!e) {
        e = {
            id: playerId,
            pos: { x: 0, y: 0, z: 0 },
            vel: { x: 0, y: 0, z: 0 },
            hp: 100,
        };
        world.entities.set(playerId, e);
    }
    return e;
}
