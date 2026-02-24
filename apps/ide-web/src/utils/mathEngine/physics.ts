// Physics Simulation - Friction and forces on inclined plane
import { MathEngine } from "./core";

export interface PhysicsState {
  position: number; // along slope (0 to rampLength)
  velocity: number; // m/s along slope
  stuck: boolean; // static friction engaged
  angle: number; // degrees
  mass: number; // kg
  muStatic: number; // coefficient of static friction
  muKinetic: number; // coefficient of kinetic friction
  gravity: number; // m/s²
  dragCoeff: number; // air resistance coefficient
}

export interface ForceComponents {
  gravityParallel: number;
  normal: number;
  friction: number;
  drag: number;
  net: number;
}

export class PhysicsSimulation {
  state: PhysicsState;
  forces: ForceComponents;

  constructor(initialState: Partial<PhysicsState> = {}) {
    this.state = {
      position: 0,
      velocity: 0,
      stuck: true,
      angle: 20,
      mass: 2,
      muStatic: 0.5,
      muKinetic: 0.4,
      gravity: 9.8,
      dragCoeff: 0.001,
      ...initialState,
    };

    this.forces = this.calculateForces();
  }

  calculateForces(): ForceComponents {
    const { mass, gravity, angle, muStatic, muKinetic, velocity, dragCoeff, stuck } = this.state;

    const normal = MathEngine.physics.normalForce(mass, gravity, angle);
    const gravityParallel = MathEngine.physics.gravityComponent(mass, gravity, angle);
    const drag = MathEngine.physics.dragForce(velocity, dragCoeff);

    let friction = 0;
    if (stuck && Math.abs(velocity) < 0.01) {
      // Static friction: up to μs * N, opposes gravity component
      const maxStatic = MathEngine.physics.friction(normal, muStatic);
      if (Math.abs(gravityParallel) <= maxStatic) {
        friction = -gravityParallel; // exactly cancels gravity
      } else {
        // Break loose
        this.state.stuck = false;
        friction = -Math.sign(gravityParallel) * MathEngine.physics.friction(normal, muKinetic);
      }
    } else {
      // Kinetic friction: opposes motion
      const direction = Math.abs(velocity) > 0.001 ? Math.sign(velocity) : Math.sign(gravityParallel);
      friction = -direction * MathEngine.physics.friction(normal, muKinetic);
    }

    const net = gravityParallel + friction + drag;

    return { gravityParallel, normal, friction, drag, net };
  }

  step(dt: number) {
    this.forces = this.calculateForces();

    const acceleration = this.forces.net / this.state.mass;

    // Semi-implicit Euler integration
    this.state.velocity += acceleration * dt;
    this.state.position += this.state.velocity * dt;

    // Boundary checks
    if (this.state.position < 0) {
      this.state.position = 0;
      this.state.velocity = 0;
      this.state.stuck = true;
    }

    // Check if velocity is near zero for static friction
    if (Math.abs(this.state.velocity) < 0.01 && !this.state.stuck) {
      const normal = MathEngine.physics.normalForce(this.state.mass, this.state.gravity, this.state.angle);
      const gravityParallel = MathEngine.physics.gravityComponent(this.state.mass, this.state.gravity, this.state.angle);
      const maxStatic = MathEngine.physics.friction(normal, this.state.muStatic);

      if (Math.abs(gravityParallel) <= maxStatic) {
        this.state.velocity = 0;
        this.state.stuck = true;
      }
    }
  }

  reset() {
    this.state.position = 0;
    this.state.velocity = 0;
    this.state.stuck = true;
    this.forces = this.calculateForces();
  }

  nudge(impulse: number) {
    this.state.velocity += impulse;
    this.state.stuck = false;
  }

  updateParams(params: Partial<PhysicsState>) {
    Object.assign(this.state, params);
    this.forces = this.calculateForces();
  }
}

export class PhysicsRenderer {
  constructor(
    private canvas: HTMLCanvasElement,
    private rampLength = 400
  ) {}

  render(simulation: PhysicsSimulation) {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "rgba(112, 240, 201, 0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw ramp
    const angle = MathEngine.trig.degToRad(simulation.state.angle);
    const startX = 50;
    const startY = height - 50;
    const endX = startX + Math.cos(angle) * this.rampLength;
    const endY = startY - Math.sin(angle) * this.rampLength;

    ctx.strokeStyle = "rgba(158, 210, 255, 0.5)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw block at position along ramp
    const blockPos = (simulation.state.position / 10) * this.rampLength; // scale position
    const blockX = startX + Math.cos(angle) * blockPos;
    const blockY = startY - Math.sin(angle) * blockPos;
    const blockSize = 30;

    ctx.save();
    ctx.translate(blockX, blockY);
    ctx.rotate(-angle);

    ctx.fillStyle = simulation.state.stuck ? "#284e6e" : "#1b7f58";
    ctx.strokeStyle = "#cfe6ff";
    ctx.lineWidth = 2;
    ctx.fillRect(-blockSize / 2, -blockSize / 2, blockSize, blockSize);
    ctx.strokeRect(-blockSize / 2, -blockSize / 2, blockSize, blockSize);

    ctx.restore();

    // Draw force vectors
    const scale = 5; // visual scaling
    this.drawArrow(ctx, blockX, blockY, angle, simulation.forces.gravityParallel * scale, "#9ed2ff");
    this.drawArrow(ctx, blockX, blockY, angle, simulation.forces.friction * scale, "#ffb86b");
    this.drawArrow(ctx, blockX, blockY, angle, simulation.forces.net * scale, "#ffffff");
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    length: number,
    color: string
  ) {
    const dx = Math.cos(angle) * length;
    const dy = -Math.sin(angle) * length;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();

    // Arrowhead
    const headSize = 8;
    const headAngle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(x + dx, y + dy);
    ctx.lineTo(
      x + dx - headSize * Math.cos(headAngle - Math.PI / 6),
      y + dy - headSize * Math.sin(headAngle - Math.PI / 6)
    );
    ctx.lineTo(
      x + dx - headSize * Math.cos(headAngle + Math.PI / 6),
      y + dy - headSize * Math.sin(headAngle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }
}
