import {
  CmdMoveSchema,
  CmdJumpSchema,
  EvMovedSchema,
  EvSpawnedSchema,
  GameCommandSchema,
  GameSnapshotSchema,
} from "@world-engine/protocol";
import type { GameEvent, GameSnapshot } from "@world-engine/protocol";
import { fnv1a32 } from "./hash";

type Position = { x: number; y: number; z: number };
type Rotation = { x: number; y: number; z: number };

export interface RuntimeEntity {
  id: string;
  prefab: string;
  pos: Position;
  rot: Rotation;
  moveX: number;
  moveZ: number;
  velocityY: number;
  grounded: boolean;
}

export interface RuntimeConfig {
  tickRateHz: number;
  moveSpeed: number;
  gravity: number;
  jumpImpulse: number;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  tickRateHz: 60,
  moveSpeed: 5,
  gravity: 18,
  jumpImpulse: 4.2,
};

export class DeterministicGameRuntime {
  private readonly config: RuntimeConfig;
  private tickValue = 0;
  private readonly entities = new Map<string, RuntimeEntity>();
  private commandQueue: Array<{ seq: number; command: ReturnType<typeof GameCommandSchema.parse> }> = [];
  private eventQueue: GameEvent[] = [];
  private snapshotValue: GameSnapshot = { tick: 0, entities: [] };
  private snapshotSubscribers = new Set<() => void>();
  private commandSeq = 0;
  private hashChainHead = "h00000000";

  constructor(config?: Partial<RuntimeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...(config ?? {}) };
  }

  get tick(): number {
    return this.tickValue;
  }

  get dtSeconds(): number {
    return 1 / this.config.tickRateHz;
  }

  get hashHead(): string {
    return this.hashChainHead;
  }

  getSnapshot(): GameSnapshot {
    return this.snapshotValue;
  }

  subscribeSnapshot(subscriber: () => void): () => void {
    this.snapshotSubscribers.add(subscriber);
    return () => {
      this.snapshotSubscribers.delete(subscriber);
    };
  }

  spawnEntity(entityId: string, prefab: string, pos?: Partial<Position>): void {
    if (this.entities.has(entityId)) return;

    const entity: RuntimeEntity = {
      id: entityId,
      prefab,
      pos: {
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        z: pos?.z ?? 0,
      },
      rot: { x: 0, y: 0, z: 0 },
      moveX: 0,
      moveZ: 0,
      velocityY: 0,
      grounded: true,
    };

    this.entities.set(entityId, entity);
    this.emitEvent(EvSpawnedSchema.parse({ kind: "EvSpawned", tick: this.tickValue, entityId }));
    this.rebuildSnapshot();
  }

  enqueueCommand(command: unknown): void {
    const validated = GameCommandSchema.parse(command);
    this.commandQueue.push({ seq: this.commandSeq, command: validated });
    this.commandSeq += 1;
  }

  drainEvents(): GameEvent[] {
    const drained = this.eventQueue;
    this.eventQueue = [];
    return drained;
  }

  step(): void {
    this.tickValue += 1;
    this.applyCommands();
    this.systemMovement();
    this.rebuildSnapshot();
    this.extendHashChain();
  }

  private applyCommands(): void {
    const eligible = this.commandQueue
      .filter(({ command }) => command.tick <= this.tickValue)
      .sort((left, right) => {
        if (left.command.tick !== right.command.tick) return left.command.tick - right.command.tick;
        if (left.command.entityId !== right.command.entityId) {
          return left.command.entityId.localeCompare(right.command.entityId);
        }
        if (left.command.kind !== right.command.kind) return left.command.kind.localeCompare(right.command.kind);
        return left.seq - right.seq;
      });

    this.commandQueue = this.commandQueue.filter(({ command }) => command.tick > this.tickValue);

    for (const { command } of eligible) {
      const entity = this.entities.get(command.entityId);
      if (!entity) continue;

      if (command.kind === CmdMoveSchema.shape.kind.value) {
        entity.moveX = command.x;
        entity.moveZ = command.z;
      } else if (command.kind === CmdJumpSchema.shape.kind.value) {
        if (entity.grounded) {
          entity.velocityY = this.config.jumpImpulse;
          entity.grounded = false;
        }
      }
    }
  }

  private systemMovement(): void {
    const dt = this.dtSeconds;
    const moveDelta = this.config.moveSpeed * dt;

    for (const entity of this.entities.values()) {
      entity.pos.x += entity.moveX * moveDelta;
      entity.pos.z += entity.moveZ * moveDelta;

      entity.velocityY -= this.config.gravity * dt;
      entity.pos.y += entity.velocityY * dt;

      if (entity.pos.y <= 0) {
        entity.pos.y = 0;
        entity.velocityY = 0;
        entity.grounded = true;
      }

      this.emitEvent(
        EvMovedSchema.parse({
          kind: "EvMoved",
          tick: this.tickValue,
          entityId: entity.id,
          px: entity.pos.x,
          py: entity.pos.y,
          pz: entity.pos.z,
        }),
      );
    }
  }

  private rebuildSnapshot(): void {
    const entities = Array.from(this.entities.values())
      .map((entity) => ({
        id: entity.id,
        px: entity.pos.x,
        py: entity.pos.y,
        pz: entity.pos.z,
        rx: entity.rot.x,
        ry: entity.rot.y,
        rz: entity.rot.z,
        prefab: entity.prefab,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));

    this.snapshotValue = GameSnapshotSchema.parse({ tick: this.tickValue, entities });
    for (const subscriber of this.snapshotSubscribers) subscriber();
  }

  private emitEvent(event: GameEvent): void {
    this.eventQueue.push(event);
  }

  private extendHashChain(): void {
    const snapshot = this.snapshotValue.entities
      .map((entity) => `${entity.id}:${entity.px.toFixed(4)}:${entity.py.toFixed(4)}:${entity.pz.toFixed(4)}`)
      .join("|");
    const eventDigest = this.eventQueue.map((event) => `${event.kind}:${event.entityId}:${event.tick}`).join("|");
    const payload = `${this.hashChainHead}#${this.tickValue}#${snapshot}#${eventDigest}`;
    this.hashChainHead = fnv1a32(payload);
  }
}
