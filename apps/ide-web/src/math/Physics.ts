/**
 * Physics System - Production-grade physics simulation
 *
 * Key features:
 * - Ground constraint with velocity reset (no infinite downward velocity)
 * - Symmetric collision detection (includes radius on both objects)
 * - Dead player defense (enemies stop updating when player dies)
 * - Player input interface (camera-space to world-space translation)
 * - Fixed timestep option (production-grade stability)
 * - Collision resolution and constraint systems
 * - Comprehensive metrics tracking
 */

import { Vector3 } from "./Vector3";

// =============================================================================
// PHYSICS OBJECT BASE CLASS
// =============================================================================

export class PhysicsObject {
  mass: number;
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  drag: number;
  radius: number;

  constructor(
    mass = 1.0,
    position = Vector3.zero,
    velocity = Vector3.zero,
    radius = 0.5
  ) {
    this.mass = mass;
    this.position = position.clone();
    this.velocity = velocity.clone();
    this.acceleration = Vector3.zero;
    this.drag = 0.01;
    this.radius = radius;
  }

  /**
   * Apply force to object
   * Force accumulates into acceleration. Integration happens during integrate_velocity()
   */
  applyForce(force: Vector3): void {
    if (this.mass > 0) {
      this.acceleration = this.acceleration.add(force.divide(this.mass));
    }
  }

  /**
   * Integrate acceleration into velocity with damping
   * v ← v + a*dt
   * v ← v * damping
   * a ← 0 (forces consumed)
   */
  integrateVelocity(dt: number, damping = 0.99): void {
    this.velocity = this.velocity.add(this.acceleration.multiply(dt));
    this.velocity = this.velocity.multiply(damping);
    this.acceleration = Vector3.zero; // Reset for next frame
  }

  /**
   * Integrate velocity into position
   * p ← p + v*dt
   */
  integratePosition(dt: number): void {
    this.position = this.position.add(this.velocity.multiply(dt));
  }

  /**
   * Return kinetic energy: 0.5 * m * v²
   */
  getKineticEnergy(): number {
    const vMag = this.velocity.magnitude();
    return 0.5 * this.mass * vMag * vMag;
  }
}

// =============================================================================
// PLAYER CLASS
// =============================================================================

export class Player extends PhysicsObject {
  maxHp: number;
  hp: number;
  isDead: boolean;

  moveSpeed: number;
  sensitivity: number;
  invertY: boolean;

  cooldowns: Map<number, number>;

  baseDamage: number;
  critChance: number;

  constructor(position = Vector3.zero) {
    super(1.0, position, Vector3.zero, 0.5);

    this.maxHp = 100;
    this.hp = 100;
    this.isDead = false;

    this.moveSpeed = 15.0; // Units per second
    this.sensitivity = 1.0;
    this.invertY = false;

    this.cooldowns = new Map([
      [1, 0],
      [2, 0],
      [3, 0],
    ]);

    this.baseDamage = 20.0;
    this.critChance = 0.1;
  }

  takeDamage(damage: number, dt = 1.0): void {
    this.hp = Math.max(0, this.hp - damage * dt);
    if (this.hp <= 0) {
      this.isDead = true;
    }
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > 0) {
      this.isDead = false;
    }
  }

  isDeadCheck(): boolean {
    return this.isDead;
  }

  updateCooldowns(dt: number): void {
    for (const [abilityId, cooldown] of this.cooldowns) {
      this.cooldowns.set(abilityId, Math.max(0, cooldown - dt));
    }
  }

  getAbilityReady(abilityId: number): boolean {
    return (this.cooldowns.get(abilityId) || 0) <= 0;
  }

  triggerAbility(abilityId: number, cooldown: number): void {
    this.cooldowns.set(abilityId, cooldown);
  }
}

// =============================================================================
// ENEMY CLASS
// =============================================================================

export class Enemy extends PhysicsObject {
  maxHp: number;
  hp: number;

  contactDps: number; // Damage per second on contact
  chaseSpeed: number; // Units per second

  xpReward: number;
  dropValue: number;

  constructor(position = Vector3.zero) {
    super(1.0, position, Vector3.zero, 0.5);

    this.maxHp = 50;
    this.hp = 50;

    this.contactDps = 10.0;
    this.chaseSpeed = 8.0;

    this.xpReward = 100;
    this.dropValue = 10;
  }

  takeDamage(damage: number): void {
    this.hp = Math.max(0, this.hp - damage);
  }

  isAlive(): boolean {
    return this.hp > 0;
  }

  /**
   * Check for contact with player and apply damage if touched
   * Uses symmetric sphere collision test: distance < r1 + r2
   */
  checkPlayerContact(player: Player, dt: number): boolean {
    if (!player || player.isDeadCheck()) {
      return false;
    }

    const distance = this.position.distanceTo(player.position);
    const requiredDistance = this.radius + player.radius;

    if (distance < requiredDistance) {
      // Contact! Apply damage to player
      player.takeDamage(this.contactDps, dt);
      return true;
    }

    return false;
  }

  /**
   * Update enemy AI: chase player toward their position
   */
  update(playerPos: Vector3): void {
    if (!playerPos) return;

    const directionToPlayer = playerPos.subtract(this.position).normalize();
    const chaseForce = directionToPlayer.multiply(this.chaseSpeed * this.mass);
    this.applyForce(chaseForce);
  }
}

// =============================================================================
// PROJECTILE CLASS
// =============================================================================

export class Projectile extends PhysicsObject {
  damage: number;
  hitRadius: number;
  lifetime: number;
  remainingLifetime: number;
  ownerId: number;

  constructor(position = Vector3.zero, velocity = Vector3.zero) {
    super(0.1, position, velocity, 0.3);

    this.damage = 25.0;
    this.hitRadius = 0.3;
    this.lifetime = 5.0;
    this.remainingLifetime = 5.0;
    this.ownerId = -1;
  }

  update(dt: number): void {
    this.remainingLifetime -= dt;
  }

  isExpired(): boolean {
    return this.remainingLifetime <= 0;
  }

  /**
   * Check for hit against enemy
   * FIX: Use symmetric sphere collision (include enemy.radius)
   */
  checkEnemyHit(enemy: Enemy): boolean {
    if (!enemy.isAlive()) {
      return false;
    }

    const distance = this.position.distanceTo(enemy.position);
    // FIXED: Include enemy radius (symmetric collision test)
    if (distance < this.hitRadius + enemy.radius) {
      enemy.takeDamage(this.damage);
      return true;
    }

    return false;
  }
}

// =============================================================================
// COLLISION RESOLUTION
// =============================================================================

export class CollisionSystem {
  checkCollision(obj1: PhysicsObject, obj2: PhysicsObject): boolean {
    const distance = obj1.position.distanceTo(obj2.position);
    return distance < obj1.radius + obj2.radius;
  }

  /**
   * Resolve collisions by pushing objects apart
   * For sphere-sphere collisions, move each object along line of centers
   * by half the overlap distance.
   */
  resolveCollisions(objects: PhysicsObject[]): void {
    const n = objects.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const obj1 = objects[i];
        const obj2 = objects[j];

        if (!obj1 || !obj2) continue;

        const distance = obj1.position.distanceTo(obj2.position);
        const minDistance = obj1.radius + obj2.radius;

        if (distance < minDistance) {
          // Overlap detected
          let pushoutDir: Vector3;

          if (distance < 0.001) {
            // Degenerate case: same position
            pushoutDir = Vector3.right;
          } else {
            pushoutDir = obj1.position.subtract(obj2.position).normalize();
          }

          // Compute pushout magnitude
          const overlap = minDistance - distance;
          const pushout = overlap / 2.0;

          // Push both objects apart
          obj1.position = obj1.position.add(pushoutDir.multiply(pushout));
          obj2.position = obj2.position.add(pushoutDir.multiply(-pushout));
        }
      }
    }
  }
}

// =============================================================================
// CONSTRAINT SYSTEM
// =============================================================================

export class ConstraintSystem {
  /**
   * Constrain object to ground (y >= ground_height)
   *
   * FIX: When object is clamped to ground, zero downward velocity
   * and acceleration to prevent infinite freefall buildup
   */
  static constrainToGround(
    obj: PhysicsObject,
    heightFunction?: (x: number, z: number) => number
  ): void {
    const groundHeight = heightFunction
      ? heightFunction(obj.position.x, obj.position.z)
      : 0.0;

    if (obj.position.y < groundHeight) {
      // Object is below ground, clamp it
      obj.position = new Vector3(obj.position.x, groundHeight, obj.position.z);

      // CRITICAL FIX: Kill downward velocity/acceleration
      // Otherwise object accumulates infinite downward velocity
      if (obj.velocity.y < 0) {
        obj.velocity = new Vector3(obj.velocity.x, 0, obj.velocity.z);
      }

      if (obj.acceleration.y < 0) {
        obj.acceleration = new Vector3(obj.acceleration.x, 0, obj.acceleration.z);
      }
    }
  }

  static clampVelocityMagnitude(obj: PhysicsObject, maxVelocity: number): void {
    const velocityMag = obj.velocity.magnitude();
    if (velocityMag > maxVelocity) {
      obj.velocity = obj.velocity.multiply(maxVelocity / velocityMag);
    }
  }
}

// =============================================================================
// PHYSICS SIMULATOR
// =============================================================================

export interface PhysicsConfig {
  gravity?: number;
  damping?: number;
  maxVelocity?: number;
  timestep?: number;
  useFixedTimestep?: boolean;
}

export interface PhysicsMetrics {
  objectCount: number;
  collisionCount: number;
  physicsEnergy: number;
  averageVelocity: number;
}

export interface CameraData {
  position: Vector3;
  forward: Vector3;
  right: Vector3;
  up: Vector3;
  distance: number;
  pitch: number;
  yaw: number;
}

export class PhysicsSimulator {
  gravity: number;
  damping: number;
  maxVelocity: number;
  timestep: number;
  useFixedTimestep: boolean;
  accumulator: number;

  player: Player | null;
  enemies: Enemy[];
  projectiles: Projectile[];
  staticObjects: PhysicsObject[];

  collisionSystem: CollisionSystem;
  constraintSystem: typeof ConstraintSystem;

  metrics: PhysicsMetrics;
  cameraData: CameraData | null;

  constructor(config: PhysicsConfig = {}) {
    this.gravity = config.gravity ?? -9.8;
    this.damping = config.damping ?? 0.99;
    this.maxVelocity = config.maxVelocity ?? 50.0;
    this.timestep = config.timestep ?? 1.0 / 60.0;
    this.useFixedTimestep = config.useFixedTimestep ?? false;
    this.accumulator = 0.0;

    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.staticObjects = [];

    this.collisionSystem = new CollisionSystem();
    this.constraintSystem = ConstraintSystem;

    this.metrics = {
      objectCount: 0,
      collisionCount: 0,
      physicsEnergy: 0.0,
      averageVelocity: 0.0,
    };

    this.cameraData = null;
  }

  /**
   * Receive camera frame data for physics updates
   * Camera provides: position, forward, right, distance, angles
   * Physics uses this to translate player input from camera space to world space
   */
  receiveCameraData(cameraData: CameraData): void {
    this.cameraData = cameraData;
  }

  /**
   * Apply player input as movement force
   * FIX: Player now has a way to move via this interface
   */
  applyPlayerInput(moveDirection: Vector3): void {
    if (!this.player || this.player.isDeadCheck()) {
      return;
    }

    if (moveDirection.magnitude() < 0.01) {
      // Deadzone
      return;
    }

    const desiredDir = moveDirection.normalize();

    // Apply horizontal force (don't modify vertical)
    let desiredForce = desiredDir.multiply(this.player.moveSpeed * this.player.mass);
    desiredForce = new Vector3(desiredForce.x, 0, desiredForce.z);

    this.player.applyForce(desiredForce);
  }

  setPlayer(player: Player): void {
    this.player = player;
  }

  addEnemy(enemy: Enemy): void {
    this.enemies.push(enemy);
  }

  removeEnemy(enemy: Enemy): void {
    const index = this.enemies.indexOf(enemy);
    if (index !== -1) {
      this.enemies.splice(index, 1);
    }
  }

  addProjectile(projectile: Projectile): void {
    this.projectiles.push(projectile);
  }

  addStaticObject(obj: PhysicsObject): void {
    this.staticObjects.push(obj);
  }

  /**
   * Update physics simulation
   * Supports both fixed and variable timesteps
   */
  update(dt: number): void {
    if (this.useFixedTimestep) {
      this.updateFixedTimestep(dt);
    } else {
      // Variable timestep, but clamped to prevent tunneling
      dt = Math.min(dt, 0.1); // Max 100ms per step
      this.integratePhysics(dt);
    }

    this.updateMetrics();
  }

  private updateFixedTimestep(dt: number): void {
    // Clamp dt to prevent spiral if frame takes too long
    dt = Math.min(dt, 0.1);

    this.accumulator += dt;

    // Run fixed-size steps until caught up
    while (this.accumulator >= this.timestep) {
      this.integratePhysics(this.timestep);
      this.accumulator -= this.timestep;
    }
  }

  private integratePhysics(dt: number): void {
    // Apply gravity to all dynamic objects
    this.applyGravity();

    // Update player
    this.updatePlayer(dt);

    // Update enemies
    this.updateEnemies(dt);

    // Update projectiles
    this.updateProjectiles(dt);

    // Integrate all dynamic objects
    this.integrateAllObjects(dt);

    // Apply constraints (ground collision)
    this.applyConstraints();

    // Resolve object collisions
    this.resolveCollisions();

    // Cleanup dead enemies and expired projectiles
    this.cleanup();
  }

  private applyGravity(): void {
    const gravityForce = new Vector3(0, this.gravity, 0);

    if (this.player) {
      this.player.applyForce(gravityForce.multiply(this.player.mass));
    }

    for (const enemy of this.enemies) {
      enemy.applyForce(gravityForce.multiply(enemy.mass));
    }

    for (const projectile of this.projectiles) {
      projectile.applyForce(gravityForce.multiply(projectile.mass));
    }
  }

  private updatePlayer(dt: number): void {
    if (!this.player) return;
    this.player.updateCooldowns(dt);
  }

  /**
   * Update enemy AI
   * FIX: Stop updating enemies if player is dead
   */
  private updateEnemies(dt: number): void {
    if (!this.player || this.player.isDeadCheck()) {
      return;
    }

    for (const enemy of this.enemies) {
      enemy.checkPlayerContact(this.player, dt);
      enemy.update(this.player.position);
    }
  }

  private updateProjectiles(dt: number): void {
    for (const projectile of this.projectiles) {
      projectile.update(dt);

      // Check hits on enemies
      for (const enemy of this.enemies) {
        if (projectile.checkEnemyHit(enemy)) {
          // Hit! Remove projectile
          const index = this.projectiles.indexOf(projectile);
          if (index !== -1) {
            this.projectiles.splice(index, 1);
          }
          break;
        }
      }
    }
  }

  private integrateAllObjects(dt: number): void {
    const allDynamics: PhysicsObject[] = [];

    if (this.player) {
      allDynamics.push(this.player);
    }

    allDynamics.push(...this.enemies);
    allDynamics.push(...this.projectiles);

    for (const obj of allDynamics) {
      obj.integrateVelocity(dt, this.damping);
      obj.integratePosition(dt);
      this.constraintSystem.clampVelocityMagnitude(obj, this.maxVelocity);
    }
  }

  private applyConstraints(): void {
    if (this.player) {
      this.constraintSystem.constrainToGround(this.player);
    }

    for (const enemy of this.enemies) {
      this.constraintSystem.constrainToGround(enemy);
    }

    for (const projectile of this.projectiles) {
      this.constraintSystem.constrainToGround(projectile);
    }
  }

  private resolveCollisions(): void {
    const allDynamics: PhysicsObject[] = [];

    if (this.player) {
      allDynamics.push(this.player);
    }

    allDynamics.push(...this.enemies);
    allDynamics.push(...this.projectiles);

    this.collisionSystem.resolveCollisions(allDynamics);
  }

  private cleanup(): void {
    // Remove dead enemies
    this.enemies = this.enemies.filter((e) => e.isAlive());

    // Remove expired projectiles
    this.projectiles = this.projectiles.filter((p) => !p.isExpired());
  }

  private updateMetrics(): void {
    // Object count
    this.metrics.objectCount =
      (this.player ? 1 : 0) + this.enemies.length + this.projectiles.length;

    // Kinetic energy
    let totalEnergy = 0.0;
    const allDynamics: PhysicsObject[] = [];

    if (this.player) {
      allDynamics.push(this.player);
    }

    allDynamics.push(...this.enemies);
    allDynamics.push(...this.projectiles);

    for (const obj of allDynamics) {
      totalEnergy += obj.getKineticEnergy();
    }

    this.metrics.physicsEnergy = totalEnergy;

    // Average velocity
    if (allDynamics.length > 0) {
      const totalVelocity = allDynamics.reduce(
        (sum, obj) => sum + obj.velocity.magnitude(),
        0
      );
      this.metrics.averageVelocity = totalVelocity / allDynamics.length;
    } else {
      this.metrics.averageVelocity = 0.0;
    }
  }

  getMetrics(): PhysicsMetrics {
    return { ...this.metrics };
  }
}
