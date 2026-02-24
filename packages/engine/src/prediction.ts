/**
 * Client-Side Prediction + Reconciliation Engine
 * Handles local prediction while waiting for server ack
 */

import type { BoxCollider, CollisionEvent } from './collision';
import { predictMove, slideAlongCollision } from './collision';

export type PredictedEntity = {
    id: string;
    pos: { x: number; y: number };
    vel: { x: number; y: number };
    collider?: { radius: number }; // Circle collider for collision detection
};

export type PredictionState = {
    tick: number;
    entities: Map<string, PredictedEntity>;
    inputs: Array<{ seq: number; move: { x: number; y: number }; tick: number }>;
};

export class PredictionEngine {
    private playerId: string;
    private predicted: PredictionState = {
        tick: 0,
        entities: new Map(),
        inputs: []
    };

    private authoritative: PredictionState = {
        tick: 0,
        entities: new Map(),
        inputs: []
    };

    private inputSeq = 0;
    private readonly maxRewindDistance = 500; // pixels
    private staticColliders: BoxCollider[] = [];
    private lastCollisions: CollisionEvent[] = [];

    constructor(playerId: string, staticColliders: BoxCollider[] = []) {
        this.playerId = playerId;
        this.staticColliders = staticColliders;
    }

    /**
     * Apply input to predicted state immediately (for instant feedback)
     */
    predictInput(move: { x: number; y: number }): number {
        const inputSeq = this.inputSeq++;

        // Record input for rewind/replay
        this.predicted.inputs.push({
            seq: inputSeq,
            move: { ...move },
            tick: this.predicted.tick
        });

        // Apply to predicted own entity
        const ownEntity = this.predicted.entities.get(this.playerId);
        if (ownEntity) {
            // Instant velocity update (no acceleration delay for prediction)
            ownEntity.vel.x = move.x * 6; // maxSpeed constant from sim
            ownEntity.vel.y = move.y * 6;
        }

        return inputSeq;
    }

    /**
     * Receive authoritative snapshot from server
     * Reconcile predicted vs authoritative
     */
    reconcile(snapshot: {
        tick: number;
        entities: Array<{ id: string; pos: { x: number; y: number }; vel: { x: number; y: number } }>;
    }): void {
        // Store authoritative state
        this.authoritative.tick = snapshot.tick;
        this.authoritative.entities.clear();

        for (const entity of snapshot.entities) {
            this.authoritative.entities.set(entity.id, { ...entity });
        }

        // Check if own entity diverged
        const authOwnEntity = this.authoritative.entities.get(this.playerId);
        const predOwnEntity = this.predicted.entities.get(this.playerId);

        if (authOwnEntity && predOwnEntity) {
            const divergence =
                Math.sqrt(
                    Math.pow(authOwnEntity.pos.x - predOwnEntity.pos.x, 2) +
                    Math.pow(authOwnEntity.pos.y - predOwnEntity.pos.y, 2)
                );

            // If divergence is small, trust prediction; otherwise snap to authority
            if (divergence > this.maxRewindDistance) {
                // Large divergence: snap to authority (possible rollback/cheat)
                predOwnEntity.pos = { ...authOwnEntity.pos };
                predOwnEntity.vel = { ...authOwnEntity.vel };
            } else if (divergence > 1) {
                // Small divergence: smoothly blend (75% predicted, 25% auth for stability)
                const blend = 0.1; // 10% step toward authority per frame
                predOwnEntity.pos.x += (authOwnEntity.pos.x - predOwnEntity.pos.x) * blend;
                predOwnEntity.pos.y += (authOwnEntity.pos.y - predOwnEntity.pos.y) * blend;
            }
        }

        // Other players always use authoritative state
        for (const [id, entity] of this.authoritative.entities) {
            if (id !== this.playerId) {
                this.predicted.entities.set(id, { ...entity });
            }
        }
    }

    /**
     * Step prediction forward for next frame
     * Simple physics: position += velocity * dt
     * Includes collision detection and response
     */
    stepPrediction(dt: number): void {
        for (const entity of this.predicted.entities.values()) {
            // Skip collision for non-collidable entities
            if (!entity.collider) {
                entity.pos.x += entity.vel.x * dt;
                entity.pos.y += entity.vel.y * dt;
                entity.vel.x *= 0.98;
                entity.vel.y *= 0.98;
                continue;
            }

            // Predict next position with collision detection
            const otherEntities = this.playerId === entity.id
                ? new Map<string, any>(
                    [...this.predicted.entities.entries()].filter(
                        ([id]) => id !== this.playerId
                    )
                )
                : undefined;

            const prediction = predictMove(
                entity.pos,
                entity.vel,
                dt,
                entity.collider.radius,
                this.staticColliders,
                otherEntities
            );

            // Handle collisions
            if (prediction.collisions.length > 0) {
                this.lastCollisions = prediction.collisions;

                if (!prediction.canMove) {
                    // Can't move: slide along wall or stop
                    if (prediction.collisions[0]) {
                        const { velocity: slideVel } = slideAlongCollision(
                            entity.pos,
                            entity.vel,
                            prediction.collisions[0]
                        );
                        // Only apply slide if it actually helps forward
                        const slideMag = Math.sqrt(slideVel.x * slideVel.x + slideVel.y * slideVel.y);
                        const origMag = Math.sqrt(
                            entity.vel.x * entity.vel.x + entity.vel.y * entity.vel.y
                        );
                        if (slideMag > origMag * 0.5) {
                            entity.vel = slideVel;
                        } else {
                            entity.vel.x = 0;
                            entity.vel.y = 0;
                        }
                    }
                    // Don't update position if collision detected
                } else {
                    // Can move, but might have entity collisions
                    entity.pos = prediction.nextPos;
                }
            } else {
                // No collision: move freely
                entity.pos = prediction.nextPos;
            }

            // Friction damping
            entity.vel.x *= 0.98;
            entity.vel.y *= 0.98;
        }
        this.predicted.tick += 1;
    }

    /**
     * Get current visual state (blended predicted + authoritative)
     */
    getVisualState(): PredictionState {
        return {
            ...this.predicted,
            entities: new Map(this.predicted.entities) // Copy for safety
        };
    }

    /**
     * Get last collision events detected in stepPrediction
     */
    getLastCollisions(): CollisionEvent[] {
        return this.lastCollisions;
    }

    /**
     * Update static colliders (e.g., when level changes)
     */
    setStaticColliders(colliders: BoxCollider[]): void {
        this.staticColliders = colliders;
    }

    /**
     * Initialize entities from snapshot
     */
    initializeFromSnapshot(snapshot: {
        entities: Array<{ id: string; pos: { x: number; y: number }; vel: { x: number; y: number } }>;
    }): void {
        this.predicted.entities.clear();
        for (const entity of snapshot.entities) {
            this.predicted.entities.set(entity.id, { ...entity });
        }
        this.reconcile({ tick: 0, entities: snapshot.entities });
    }
}
